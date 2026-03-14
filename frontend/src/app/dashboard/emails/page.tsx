"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../auth-context";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Upload, Trash2, AlertCircle, Clock, Users, Zap, Wand2, Sparkles } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

interface ScheduledEmail {
  id: string;
  event_id: string;
  subject: string;
  body: string;
  send_time: string;
  status: string;
}

interface EventOption {
  id: string;
  title: string;
}

export default function EmailsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [manualEmails, setManualEmails] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) {
      fetchEvents();
      fetchEmails();
    }
  }, [token]);

  const fetchEvents = async () => {
    const res = await fetch(`${API_BASE}/events`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
      if (data.length > 0) setSelectedEvent(data[0].id);
    }
  };

  const fetchEmails = async () => {
    const res = await fetch(`${API_BASE}/emails/scheduled`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setEmails(await res.json());
  };

  const scheduleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || (files.length === 0 && !manualEmails)) {
      setError("Please provide at least one recipient (file or manual list).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("event_id", selectedEvent);
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("send_time", sendTime);
      formData.append("manual_emails", manualEmails);
      formData.append("smtp_user", smtpUser);
      formData.append("smtp_password", smtpPassword);
      files.forEach((file) => formData.append("files", file));
      const res = await fetch(`${API_BASE}/emails/schedule`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to schedule email");
      }
      await fetchEmails();
      setSubject("");
      setBody("");
      setSendTime("");
      setManualEmails("");
      setSmtpUser("");
      setSmtpPassword("");
      setFiles([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmail = async (id: string) => {
    await fetch(`${API_BASE}/emails/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setEmails(emails.filter((e) => e.id !== id));
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt || !selectedEvent) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/emails/generate-copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ event_id: selectedEvent, prompt: aiPrompt })
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setSubject(data.subject);
      setBody(data.body);
      if (data.suggested_send_time) setSendTime(data.suggested_send_time);
      setAiPrompt("");
    } catch (err) {
      alert("AI Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
      </div>

      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Mail className="w-5 h-5 text-purple-300" />
          <span className="font-bold text-white">OrgaNexus | Email Scheduler</span>
        </div>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE}/emails/test-smtp`, {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({
                  smtp_user: smtpUser || undefined,
                  smtp_password: smtpPassword || undefined
                })
              });
              const data = await res.json();
              if (res.ok) alert(data.message);
              else alert("Connection Failed: " + data.detail);
            } catch (err: any) {
              alert("Error: " + err.message);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="text-xs font-bold text-purple-300 bg-purple-400/10 hover:bg-purple-400/20 px-4 py-2 rounded-full border border-purple-300/20 transition-all flex items-center gap-2"
        >
          <Zap className="w-3 h-3" /> Test SMTP Connection
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Schedule New Email */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-3xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-300" /> Schedule Email Blast
          </h2>

          {events.length === 0 ? (
            <p className="text-neutral-400 text-sm">Create an event first to schedule emails.</p>
          ) : (
            <form onSubmit={scheduleEmail} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Event</label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white appearance-none focus:ring-1 focus:ring-purple-400 shadow-inner"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5 flex justify-between">
                    Send Time <span className="text-[10px] text-neutral-600 uppercase">Optional for immediate</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner"
                  />
                </div>
              </div>
              <div className="relative group p-[1px] rounded-xl overflow-hidden bg-white/5 mb-2">
                {/* Shiny Border Effect */}
                <motion.div
                  animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-[length:200%_auto] opacity-20 group-hover:opacity-100 transition-opacity"
                />
                <div className="relative bg-[#0d0d0d] rounded-[inherit] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-4 h-4 text-purple-300" />
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Generate with AI</span>
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Write a welcome email for those who registered late..."
                      className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !aiPrompt}
                      className="px-4 py-1.5 bg-purple-500 hover:bg-purple-400 disabled:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                    >
                      {isGenerating ? "Magic..." : "Generate ✨"}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner placeholder-neutral-500"
                  placeholder="e.g. Important Update: Schedule Change for Day 2"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">Email Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none h-32 shadow-inner placeholder-neutral-500"
                  placeholder="Write the email content..."
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">Manual Recipient Emails</label>
                <textarea
                  value={manualEmails}
                  onChange={(e) => setManualEmails(e.target.value)}
                  placeholder="Paste manual emails here (comma or newline separated)..."
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none h-20 shadow-inner placeholder-neutral-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1.5 flex justify-between">
                  Recipients (CSV/Excel) <span className="text-[10px] text-neutral-600 uppercase">Multiple allowed</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-16 border border-dashed border-purple-300/30 bg-purple-400/5 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-purple-400/10 hover:border-purple-300/50 transition-all text-sm text-purple-200/80"
                >
                  <Upload className="w-5 h-5 text-purple-300" />
                  {files.length > 0 ? (
                    <span className="truncate max-w-[250px]">{files.length} file(s) selected</span>
                  ) : (
                    "Upload recipient list(s) (must have 'email' column)"
                  )}
                </div>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx"
                  ref={fileRef}
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">SMTP User (Optional)</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner placeholder-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">SMTP Password (Optional)</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner placeholder-neutral-500"
                  />
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || (!files.length && !manualEmails)}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(192,132,252,0.3)] disabled:opacity-50"
              >
                Schedule Email
              </button>
            </form>
          )}
        </motion.div>

        {/* List Scheduled Emails */}
        <h3 className="text-lg font-bold text-white mb-4">Scheduled Emails</h3>
        <div className="space-y-3">
          {emails.length === 0 && (
            <p className="text-neutral-500 text-center py-8">No scheduled emails yet.</p>
          )}
          {emails.map((email, i) => (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl p-5 flex items-start justify-between gap-4 border border-white/5"
            >
              <div>
                <p className="text-white font-medium text-sm">{email.subject}</p>
                <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{email.body}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-purple-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(email.send_time).toLocaleString()}
                  </span>
                  <span className="text-xs text-neutral-500">{email.status}</span>
                </div>
              </div>
              <button onClick={() => deleteEmail(email.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
