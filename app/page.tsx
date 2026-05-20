'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Plus, 
  Sparkles, 
  MessageSquare, 
  BookOpen, 
  GraduationCap, 
  Settings 
} from 'lucide-react';

export default function CFAChat() {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    isLoading, 
    setMessages 
  } = useChat() as any;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!mounted) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden font-sans">
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0 hidden md:flex border-r border-gray-800">
        <div className="p-4">
          <button onClick={() => setMessages([])} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all text-sm font-medium">
            <Plus size={16} /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <p className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 mb-2">Study history</p>
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 text-blue-400 rounded-lg border border-gray-700/50 text-sm">
            <MessageSquare size={14} /> <span className="truncate">Current chat</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative bg-gray-50/50">
        <header className="h-14 flex items-center px-6 bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <GraduationCap size={20} />
            </div>
            <span className="font-bold text-gray-800 tracking-tight">CFA AI Tutor</span>
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-3xl mx-auto w-full py-10 px-6 space-y-10">
            {messages.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-inner">
                  <Sparkles size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Hi, I am your CFA tutor. </h2>
              </div>
            ) : (
              // 🌟 這裡添加了類型標註 m: any, idx: number
              messages.map((m: any, idx: number) => (
                <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                      m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-blue-600'
                    }`}>
                      {m.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                    </div>
                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${
                      m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      {/* 🌟 修正了 ReactMarkdown 的樣式報錯 */}
                      <div className="prose prose-sm max-w-none text-inherit">
                        <ReactMarkdown remarkPlugins={[remarkGfm as any]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-4 animate-in fade-in duration-300">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-blue-600">
                  <Bot size={20} className="animate-pulse" />
                </div>
                <div className="px-5 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center gap-3">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500 font-medium">Reading textbook...</span>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="p-6 pt-2 bg-white border-t border-gray-100">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative group">
            <input
              className="w-full pl-5 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-800"
              value={input}
              placeholder="Ask a question..."
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl active:scale-95">
              <Send size={18} />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}