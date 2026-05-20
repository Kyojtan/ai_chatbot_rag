import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai'; // 🌟 建議使用 AI SDK 的輔助函數

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // 確保這是 Service Role Key
const openAiKey = process.env.OPENAI_API_KEY || '';

const openai = new OpenAI({ apiKey: openAiKey });
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // 1. 生成向量
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: lastMessage,
    });
    const [{ embedding }] = embeddingResponse.data;

    // 2. 檢索資料庫 (RPC 內部已指向 cfa_materials)
    const { data: documents, error: dbError } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
    });

    if (dbError) throw new Error(`資料庫檢索失敗: ${dbError.message}`);

    // 3. 構建上下文與來源標籤
    const contextText = documents
    ?.map((doc: any) => `[來源文件: ${doc.metadata.file_name}, 頁碼: ${doc.metadata.chunk_index}]\n內容: ${doc.content}`)
    .join("\n---\n") || "";
      console.log("=== 傳送給 AI 的上下文 ===\n", contextText);

    const sources = documents?.map((doc: any) => ({
      file: doc.metadata?.file_name?.split('/').pop() || 'CFA 教材',
      similarity: `${Math.round(doc.similarity * 100)}%`
    })) || [];

    // 4. 調用 OpenAI (修正模型名稱)
    // ⚠️ 錯誤修正：'gpt-3.5-turbo-preview' 可能不存在或無權限，改用穩定版 'gpt-3.5-turbo'
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', 
      stream: true,
      messages: [
        { 
          role: 'system', 
          content: `你是一名嚴謹的 CFA Level I 講師，请运用苏格拉底诘问法，通过反问，引导学生学习。

          嚴格指令：
          1. 如果提供的上下文內容中沒有答案，請直接回答：「目前的 CFA 教材庫中沒有關於此問題的具體資訊。」除此之外，请搜索网络找到问题答案。
          2. **來源標註**：必須且只能從上下文提供的資料中提取檔名與頁碼。如果答案不是來自上下文，嚴禁捏造任何參考來源。
          3. **參考來源格式**：[檔名, 第 X 頁]。
          
          上下文內容:
          ${contextText}` 
        },
        ...messages
      ],
    });

    // 5. 使用 OpenAIStream 簡化流處理邏輯
    const stream = OpenAIStream(response as any);

    return new StreamingTextResponse(stream, {
      headers: {
        'X-Sources': encodeURIComponent(JSON.stringify(sources)),
      },
    });

  } catch (error: any) {
    console.error("API 運行時錯誤:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}