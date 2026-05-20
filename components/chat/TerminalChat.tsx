"use client";
import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from "react";

export default function TerminalChat() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // 手动处理发送
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
        // 🌟 解析 DeepSeek 返回的 SSE 格式数据 (data: {"choices":[...]})
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.substring(6));
              const content = data.choices[0].delta.content || "";
              
              // 实时追加文字
              setMessages(prev => {
                const newMsgs = [...prev];
                const last = newMsgs[newMsgs.length - 1];
                newMsgs[newMsgs.length - 1] = { ...last, content: last.content + content };
                return newMsgs;
              });
            } catch (e) {
              // 忽略解析失败的碎片
            }
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-black/90 p-4 font-mono text-green-500 border border-green-900 rounded-lg">
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-2">
{messages.map((m, i) => (
  <div key={i} className="mb-4"> {/* 增加每条消息的间距 */}
    <div className={m.role === "user" ? "text-blue-400 mb-1" : "text-yellow-500 mb-1"}>
      {m.role === "user" ? "User:" : "Tutor:"}
    </div>
    
    <div className="pl-4 border-l border-green-900/30 text-green-400">
      {m.role === "assistant" ? (
        <div className={m.role === "assistant" ? "prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800" : ""}>
  <ReactMarkdown>
    {m.content}
  </ReactMarkdown>
</div>
      ) : (
        <div className="whitespace-pre-wrap">{m.content}</div>
      )}
    </div>
  </div>
))}
      </div>

      <form onSubmit={handleSend} className="flex border-t border-green-900 pt-2">
        <span className="mr-2">tutor@cfa:~$</span>
        <input
          className="flex-1 bg-transparent outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
      </form>
    </div>
  );
}