import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import PdfParser from 'pdf2json';

// 1. 初始化客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 延迟函数：降低并发压力，防止网络抖动
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * PDF 解析逻辑
 */
function parsePdf(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PdfParser as any)(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve((pdfParser as any).getRawTextContent());
    });
    pdfParser.loadPDF(filePath);
  });
}

/**
 * 递归扫描目录
 */
async function processDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.error(`❌ 找不到目录: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await processDirectory(fullPath);
    } else if (file.endsWith('.pdf')) {
      await ingestPDF(fullPath);
    }
  }
}

/**
 * 单个 PDF 入库 (Data Ingestion)
 */
async function ingestPDF(filePath: string) {
  try {
    console.log(`⏳ Reading: ${path.basename(filePath)}...`);
    const fullText = await parsePdf(filePath);
    
    if (!fullText || fullText.trim().length === 0) {
      console.warn(`⚠️ 文件为空或解析失败: ${filePath}`);
      return;
    }

    // 按 1000 字左右切块 (Chunking)
    const chunks = fullText.match(/[\s\S]{1,1500}/g) || [];
    const category = path.dirname(filePath).split(path.sep).pop();
    
    console.log(`🚀 Vectorizing [${category}]: ${path.basename(filePath)} (${chunks.length} chunks)...`);

    for (let i = 0; i < chunks.length; i++) {
      const originalChunk = chunks[i];
      
      // 🌟 清理逻辑：只为了通过 OpenAI 的 API 校验，不影响数据库存储
      const cleanChunk = originalChunk.replace(/\\u[a-zA-Z0-9]{0,3}[^a-zA-Z0-9]/g, '');

      try {
        // 1. 生成 Embedding (使用清理后的文本)
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: cleanChunk.replace(/\n/g, " "),
        });

        const [{ embedding }] = embeddingResponse.data;

        // 2. 存入 Supabase (使用原始文本 originalChunk 以保留公式)
        const { error } = await supabase
          .from('cfa_materials')
          .insert({
            content: originalChunk, 
            embedding: embedding,
            metadata: { 
              file_name: path.basename(filePath),
              category: category,
              chunk_index: i,
              ingested_at: new Date().toISOString()
            }
          });

        if (error) throw error;

        // 每处理 3 块停 200ms，保持请求稳定
        if (i % 3 === 0) await sleep(200);

      } catch (chunkErr: any) {
        console.error(`  ⚠️ Chunk ${i} 失败，已跳过。错误: ${chunkErr.message}`);
        await sleep(1500); // 遇到报错多等一会
      }
    }
    console.log(`✅ Success: ${path.basename(filePath)}`);
  } catch (err: any) {
    console.error(`❌ 处理文件 ${path.basename(filePath)} 时出错:`, err.message);
  }
}



// 启动执行
processDirectory('./cfa_data/mock test');
