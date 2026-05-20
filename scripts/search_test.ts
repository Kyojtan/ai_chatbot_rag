import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 余弦相似度计算函数（本地计算）
function cosineSimilarity(a: number[], b: number[]) {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function fastSearch(query: string) {
  try {
    console.log(`\n🚀 正在执行「本地加速」搜索: "${query}"...`);

    // 1. 获取问题的向量
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVector = resp.data[0].embedding;

    // 2. 直接从表里抓取数据（绕过 RPC 匹配，只抓内容和向量）
    console.log("📡 正在从数据库下载候选数据...");
    const { data: rows, error } = await supabase
      .from('cfa_materials')
      .select('id, content, metadata, embedding')
      .limit(50); // 先抓 50 条测试，速度极快

    if (error) throw error;
    if (!rows) return console.log("数据库是空的！");

    // 3. 在本地内存进行匹配
    console.log(`💻 正在本地计算 ${rows.length} 条数据的相似度...`);
    const results = rows
    .map(row => {
        // 🌟 核心修复：确保 embedding 是数组格式
        const vectorB = typeof row.embedding === 'string' 
        ? JSON.parse(row.embedding) 
        : row.embedding;

        return {
        ...row,
        similarity: cosineSimilarity(queryVector, vectorB)
        };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

    // 4. 打印结果
    console.log("\n🎯 搜索结果：\n");
    results.forEach((res, i) => {
      console.log(`[匹配 ${i+1}] 相关度: ${(res.similarity * 100).toFixed(2)}%`);
      console.log(`来源: ${res.metadata.file_name}`);
      console.log(`内容: ${res.content.substring(0, 200)}...\n`);
    });

  } catch (err: any) {
    console.error("❌ 错误:", err.message);
  }
}

fastSearch("How to calculate CAPM?");