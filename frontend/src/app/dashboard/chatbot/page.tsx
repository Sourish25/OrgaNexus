"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../auth-context";
import { useRouter } from "next/navigation";
import { BrainCircuit, Send, MessageCircle, Bot, User, ArrowLeft } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

interface Message {
  role: "user" | "bot";
  content: string;
}

export default function ChatbotPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "Hi! I'm the OrgaNexus Helpdesk assistant. Ask me anything about your event — schedules, venues, logistics, or general queries. How can I help?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", content: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <MessageCircle className="w-5 h-5 text-purple-300" />
        <span className="font-bold text-white">Helpdesk Chatbot</span>
      </nav>

      {/* Messages */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "bot" && (
                <div className="w-8 h-8 rounded-full bg-purple-400/20 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-purple-300" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-500/80 text-white rounded-br-md"
                    : "glass-panel text-neutral-200 rounded-bl-md border border-white/10"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-neutral-300" />
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-400/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-300" />
              </div>
              <div className="glass-panel px-4 py-3 rounded-2xl rounded-bl-md border border-white/10">
                <motion.div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-purple-300"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 glass-panel border-t border-white/10 px-4 py-4">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about schedules, venues, logistics..."
            className="flex-1 bg-black/40 border border-purple-300/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 transition-colors shadow-inner placeholder-neutral-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-purple-500 hover:bg-purple-400 text-white rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(192,132,252,0.3)]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
