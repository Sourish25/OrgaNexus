"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../auth-context";
import { useRouter } from "next/navigation";
import { BrainCircuit, Upload, Send, Calendar, Share2, AlertCircle, CheckCircle2, Settings, Zap, ArrowLeft, ShieldCheck, Database, Layers, SlidersHorizontal } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

export default function SwarmConfigPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [eventDetails, setEventDetails] = useState("");
  const [scheduleConstraints, setScheduleConstraints] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [requireApproval, setRequireApproval] = useState(false);
  const [instaAccountId, setInstaAccountId] = useState("");
  const [instaAccessToken, setInstaAccessToken] = useState("");
  const [twitterBearerToken, setTwitterBearerToken] = useState("");
  const [linkedinAccessToken, setLinkedinAccessToken] = useState("");
  const [linkedinPersonUrn, setLinkedinPersonUrn] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  // Results
  const [messages, setMessages] = useState<string[]>([]);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [logisticsPlan, setLogisticsPlan] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [savedEventId, setSavedEventId] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessages([]);
    setLogisticsPlan(null);
    setApprovalPending(false);
    setThreadId("");
    setSavedEventId("");

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);

    try {
      let data;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        if (eventDetails) formData.append("event_details", eventDetails);
        if (emailDraft) formData.append("email_draft_base", emailDraft);
        formData.append("human_approval_required", requireApproval.toString());
        if (instaAccountId) formData.append("instagram_business_account_id", instaAccountId);
        if (instaAccessToken) formData.append("instagram_access_token", instaAccessToken);
        if (twitterBearerToken) formData.append("twitter_bearer_token", twitterBearerToken);
        if (linkedinAccessToken) formData.append("linkedin_access_token", linkedinAccessToken);
        if (linkedinPersonUrn) formData.append("linkedin_person_urn", linkedinPersonUrn);
        if (smtpUser) formData.append("smtp_user", smtpUser);
        if (smtpPassword) formData.append("smtp_password", smtpPassword);

        const res = await fetch(`${API_BASE}/upload_and_trigger`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to process request");
        data = await res.json();
      } else {
        const res = await fetch(`${API_BASE}/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            event_details: eventDetails,
            scheduling_constraints: scheduleConstraints,
            email_draft_base: emailDraft,
            human_approval_required: requireApproval,
            instagram_business_account_id: instaAccountId,
            instagram_access_token: instaAccessToken,
            twitter_bearer_token: twitterBearerToken,
            linkedin_access_token: linkedinAccessToken,
            linkedin_person_urn: linkedinPersonUrn,
            smtp_user: smtpUser,
            smtp_password: smtpPassword,
          }),
        });
        if (!res.ok) throw new Error("Failed to process request");
        data = await res.json();
      }

      if (data.social_media_posts) setSocialPosts(data.social_media_posts);
      if (data.master_schedule) setSchedule(data.master_schedule);
      if (data.sent_emails) setEmails(data.sent_emails);
      if (data.logistics_plan) setLogisticsPlan(data.logistics_plan);
      if (data.current_error) setError(data.current_error);
      if (data.messages) setMessages(data.messages);
      let newEventId = "";
      if (data.event_id) {
        setSavedEventId(data.event_id);
        newEventId = data.event_id;
      }

      if (data.status === "awaiting_approval") {
        setApprovalPending(true);
        setThreadId(data.thread_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      // Automatically redirect to event detail page if swarm is completed
      // Note: we can't use savedEventId directly here due to closure, so we use the local variable OR just rely on useEffect
    }
  };

  // Add an effect to handle redirection when savedEventId updates
  useEffect(() => {
    if (savedEventId && !approvalPending && !error && !isLoading) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/event/${savedEventId}`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [savedEventId, approvalPending, error, isLoading, router]);

  const handleApprove = async () => {
    setIsLoading(true);
    setApprovalPending(false);
    try {
      const res = await fetch(`${API_BASE}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ thread_id: threadId }),
      });
      if (!res.ok) throw new Error("Approval failed");
      const data = await res.json();
      setMessages((p) => [...p, ...(data.messages || [])]);
      if (data.sent_emails) setEmails(data.sent_emails);
      if (data.logistics_plan) setLogisticsPlan(data.logistics_plan);
      if (data.current_error) setError(data.current_error);
      
      // Redirect after approval
      if (savedEventId) {
        setTimeout(() => {
          router.push(`/dashboard/event/${savedEventId}`);
        }, 2500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen selection:bg-purple-300/30 font-sans">
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-violet-400/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <BrainCircuit className="w-5 h-5 text-purple-300" />
        <span className="font-bold text-white">OrgaNexus Swarm</span>
      </nav>

      {/* Form */}
      <section className="relative z-20 max-w-7xl mx-auto px-4 py-12">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center mb-10">
            <div className="bg-black/40 border border-purple-300/20 p-1.5 rounded-full flex gap-1 shadow-inner relative z-10 w-full max-w-sm">
              <button
                type="button"
                onClick={() => setMode("basic")}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  mode === "basic" 
                  ? "bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(192,132,252,0.2)]" 
                  : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Basic (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setMode("advanced")}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === "advanced" 
                  ? "bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(192,132,252,0.2)]" 
                  : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" /> Advanced
              </button>
            </div>
          </div>

          {mode === "basic" ? (
            /* Basic Mode View */
            <div className="glass-panel glass-panel-hover rounded-3xl p-8 relative overflow-hidden group mb-12 max-w-4xl mx-auto">
              <div className="absolute top-0 right-0 w-48 h-48 bg-purple-300/10 rounded-bl-full blur-[50px] group-hover:bg-purple-300/20 transition-colors" />
              <h3 className="text-2xl font-black text-white mb-2 relative z-10">Event Details & Requirements</h3>
              <p className="text-sm text-neutral-400 mb-6 relative z-10 leading-relaxed font-light">
                Describe your event, constraints, and requirements in plain English. The Orchestrator will analyze your text and automatically generate the schedule, logistics, and content.
              </p>
              <textarea
                value={eventDetails}
                onChange={(e) => setEventDetails(e.target.value)}
                className="w-full h-48 bg-black/40 border border-purple-300/20 rounded-xl p-5 text-base focus:outline-none focus:ring-1 focus:ring-purple-300/60 resize-none transition-all relative z-10 placeholder-neutral-600 text-neutral-100 shadow-inner mb-6"
                placeholder="Example: I'm hosting 'AI Summit 2026' in Bangalore from March 25-27 for 1000 attendees with a $50k budget. The keynote is Dr. Sarah Chen. We need 3 tracks: AI, Web3, and Cloud..."
              />
              
              <div className="border-t border-purple-300/10 pt-6 relative z-10">
                <h4 className="text-sm font-bold text-white mb-2">Attendee Registry (Optional)</h4>
                <p className="text-xs text-neutral-500 mb-4">Upload a CSV to generate personalized communications for registered attendees.</p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-md h-14 border border-dashed border-purple-300/30 bg-purple-400/5 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-purple-400/10 hover:border-purple-300/50 transition-all text-sm text-purple-200/80 relative z-10"
                >
                  <Upload className="w-5 h-5 text-purple-400" />
                  {file ? <span className="truncate max-w-[200px]">{file.name}</span> : "Upload Attendee CSV"}
                </div>
                <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              </div>
              
              {/* Basic Mode Social Connects */}
              <div className="border-t border-purple-300/10 pt-6 mt-6 relative z-10">
                <h4 className="text-sm font-bold text-white mb-2">Platforms Credentials (Optional)</h4>
                <p className="text-xs text-neutral-500 mb-4">Provide keys to automate live dashboards on specific events.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="password"
                    value={instaAccessToken}
                    onChange={(e) => setInstaAccessToken(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="Instagram Access Token"
                  />
                  <input
                    type="password"
                    value={twitterBearerToken}
                    onChange={(e) => setTwitterBearerToken(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="Twitter Bearer Token"
                  />
                  <input
                    type="password"
                    value={linkedinAccessToken}
                    onChange={(e) => setLinkedinAccessToken(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="LinkedIn Access Token"
                  />
                  <input
                    type="text"
                    value={linkedinPersonUrn}
                    onChange={(e) => setLinkedinPersonUrn(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="LinkedIn User URN"
                  />
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="SMTP User (Optional)"
                  />
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    className="w-full bg-black/40 border border-purple-300/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300/40 transition-all text-neutral-200"
                    placeholder="SMTP Password (Optional)"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
            {/* Advanced Mode View (Node Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {/* Content Node */}
              <div className="glass-panel glass-panel-hover rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-300/20 rounded-bl-full blur-[40px] group-hover:bg-purple-300/30 transition-colors" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="p-3 bg-purple-400/10 rounded-2xl text-purple-300 ring-1 ring-purple-300/20"><Share2 className="w-6 h-6" /></div>
                  <span className="text-xs font-mono text-purple-200 bg-purple-400/20 px-2 py-1 rounded-md">NODE_01</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 relative z-10">Content Strategist</h3>
                <p className="text-sm text-neutral-400 mb-6 relative z-10 leading-relaxed font-light">Generate promotional social media copy and optimal release schedules.</p>
                <textarea
                  value={eventDetails}
                  onChange={(e) => setEventDetails(e.target.value)}
                  className="w-full h-32 bg-black/40 border border-purple-300/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300/60 resize-none transition-all relative z-10 placeholder-neutral-500 text-neutral-100 shadow-inner"
                  placeholder="PROMPT> Input global theme, keynote speakers, prize pools..."
                />
              </div>

              {/* Scheduler Node */}
              <div className="glass-panel glass-panel-hover rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-300/15 rounded-bl-full blur-[40px] group-hover:bg-violet-300/25 transition-colors" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="p-3 bg-violet-400/10 rounded-2xl text-violet-300 ring-1 ring-violet-300/20"><Calendar className="w-6 h-6" /></div>
                  <span className="text-xs font-mono text-violet-200 bg-violet-400/20 px-2 py-1 rounded-md">NODE_02</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 relative z-10">Dynamic Scheduler</h3>
                <p className="text-sm text-neutral-400 mb-6 relative z-10 leading-relaxed font-light">Resolve temporal constraints and spatial overlapping automatically.</p>
                <textarea
                  value={scheduleConstraints}
                  onChange={(e) => setScheduleConstraints(e.target.value)}
                  className="w-full h-32 bg-black/40 border border-violet-300/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300/60 resize-none transition-all relative z-10 placeholder-neutral-500 text-neutral-100 shadow-inner"
                  placeholder="PROMPT> Input master tracks, specific time locks, or clash detections..."
                />
              </div>

              {/* Comms Node */}
              <div className="glass-panel glass-panel-hover rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-300/15 rounded-bl-full blur-[40px] group-hover:bg-indigo-300/25 transition-colors" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="p-3 bg-indigo-400/10 rounded-2xl text-indigo-300 ring-1 ring-indigo-300/20"><Send className="w-6 h-6" /></div>
                  <span className="text-xs font-mono text-indigo-200 bg-indigo-400/20 px-2 py-1 rounded-md">NODE_03</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 relative z-10">Comms Distributor</h3>
                <p className="text-sm text-neutral-400 mb-6 relative z-10 leading-relaxed font-light">Mass-personalization engine routing targeted updates.</p>
                <textarea
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="w-full h-14 bg-black/40 border border-indigo-300/20 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300/60 resize-none transition-all relative z-10 placeholder-neutral-500 mb-3 text-neutral-100 shadow-inner"
                  placeholder="PROMPT> Base Draft..."
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-[4.5rem] border border-dashed border-indigo-300/30 bg-indigo-400/5 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-400/10 hover:border-indigo-300/50 transition-all text-sm text-indigo-200/80 relative z-10"
                >
                  <Upload className="w-5 h-5 text-indigo-300" />
                  {file ? <span className="truncate max-w-[150px]">{file.name}</span> : "Attach Registry (CSV)"}
                </div>
                <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              </div>

            </div>

          {/* API Credentials Panel (Restructured) */}
          <div className="glass-panel p-8 rounded-3xl mb-8 border-l-4 border-l-amber-400 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <Settings className="w-6 h-6 text-amber-300" />
              <h3 className="text-xl font-bold text-white tracking-wide">Platform Credentials</h3>
              <p className="text-xs text-neutral-400 font-light ml-auto">Overrides environment defaults for this specific event</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10 bg-black/30 border border-amber-300/10 rounded-xl p-5 shadow-inner">
              <div>
                <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">Instagram Account ID</label>
                <input type="text" value={instaAccountId} onChange={(e) => setInstaAccountId(e.target.value)} className="w-full bg-black/40 border border-amber-300/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300/60 transition-all font-mono text-neutral-200" placeholder="e.g. 17841400..." />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">Instagram Access Token</label>
                <input type="password" value={instaAccessToken} onChange={(e) => setInstaAccessToken(e.target.value)} className="w-full bg-black/40 border border-amber-300/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300/60 transition-all font-mono text-neutral-200" placeholder="EAAY..." />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">Twitter Bearer Token</label>
                <input type="password" value={twitterBearerToken} onChange={(e) => setTwitterBearerToken(e.target.value)} className="w-full bg-black/40 border border-amber-300/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300/60 transition-all font-mono text-neutral-200" placeholder="AAAA..." />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">LinkedIn Access Token</label>
                <input type="password" value={linkedinAccessToken} onChange={(e) => setLinkedinAccessToken(e.target.value)} className="w-full bg-black/40 border border-amber-300/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300/60 transition-all font-mono text-neutral-200" placeholder="AQWu..." />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">LinkedIn User URN</label>
                <input type="text" value={linkedinPersonUrn} onChange={(e) => setLinkedinPersonUrn(e.target.value)} className="w-full bg-black/40 border border-amber-300/20 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300/60 transition-all font-mono text-neutral-200" placeholder="urn:li:person:..." />
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-1 md:col-span-1 lg:col-span-1 border-t md:border-t-0 lg:border-t-0 border-amber-300/10 pt-2 md:pt-0 lg:pt-0">
                <div>
                  <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">SMTP User</label>
                  <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="w-full bg-black/40 border border-amber-300/10 rounded-xl p-2.5 text-xs text-white" placeholder="support@domain.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-amber-300 mb-1 uppercase tracking-tighter">SMTP Password</label>
                  <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} className="w-full bg-black/40 border border-amber-300/10 rounded-xl p-2.5 text-xs text-white" placeholder="Password" />
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {/* Config */}
          <div className="glass-panel p-8 rounded-3xl mb-12 border-l-4 border-l-purple-400 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <Settings className="w-6 h-6 text-purple-300" />
              <h3 className="text-xl font-bold text-white tracking-wide">Orchestrator Parameters</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-black/40 border border-purple-300/20 rounded-xl shadow-inner relative z-10">
              <div>
                <label className="block text-sm font-medium text-white tracking-wide">Human HITL Lock</label>
                <span className="text-xs text-neutral-500">Require manual approval before sending</span>
              </div>
              <button
                type="button"
                onClick={() => setRequireApproval(!requireApproval)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${requireApproval ? "bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.4)]" : "bg-neutral-700"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${requireApproval ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center flex-col items-center gap-4">
            {!approvalPending ? (
              <motion.button
                whileHover={!savedEventId ? { scale: 1.05 } : {}}
                whileTap={!savedEventId ? { scale: 0.95 } : {}}
                type="submit"
                disabled={isLoading || !!savedEventId}
                className={`relative group px-12 py-5 font-black text-lg rounded-full overflow-hidden transition-all border ${
                  savedEventId 
                  ? "bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]" 
                  : "bg-white text-purple-950 border-purple-200 shadow-[0_0_40px_rgba(192,132,252,0.3)] hover:shadow-[0_0_60px_rgba(192,132,252,0.5)]"
                } disabled:opacity-80 disabled:cursor-default`}
              >
                <span className="relative flex flex-col items-center gap-1">
                  <div className="flex items-center gap-3">
                    {isLoading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                          <BrainCircuit className="w-6 h-6 text-purple-900" />
                        </motion.div>
                        SYNTHESIZING...
                      </>
                    ) : savedEventId ? (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        SWARM COMPLETE
                      </>
                    ) : (
                      <>
                        <Zap className="w-6 h-6" />
                        EXECUTE SWARM
                      </>
                    )}
                  </div>
                  {savedEventId && !isLoading && (
                    <span className="text-[10px] font-mono tracking-widest opacity-60">REDIRECTING TO EVENT_DETAIL...</span>
                  )}
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleApprove}
                disabled={isLoading}
                className="relative group px-12 py-5 bg-green-500 text-white font-black text-lg rounded-full overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.3)] transition-all disabled:opacity-50 border border-green-400"
              >
                <span className="relative flex flex-col items-center gap-1">
                  <div className="flex items-center gap-3">
                    {isLoading ? "SYNTHESIZING..." : (<><CheckCircle2 className="w-6 h-6" /> APPROVE & SEND</>)}
                  </div>
                  {isLoading && (
                    <span className="text-[10px] font-mono tracking-widest opacity-60">DISTRIBUTING COMMUNICATIONS...</span>
                  )}
                </span>
              </motion.button>
            )}
            {savedEventId && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/event/${savedEventId}`)}
                className="text-sm text-purple-300 hover:text-purple-200 transition-colors"
              >
                View saved event →
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Results */}
      <section ref={resultsRef} className="max-w-7xl mx-auto px-4 py-24 min-h-[50vh]">
        <div className="flex items-center gap-4 mb-12 border-b border-purple-300/20 pb-6 relative">
          <div className="absolute bottom-[-1px] left-0 w-32 h-[1px] bg-gradient-to-r from-purple-400 to-transparent" />
          <Layers className="w-8 h-8 text-purple-300" />
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400">Execution Telemetry</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Audit Log */}
          <div className="lg:col-span-4 glass-panel rounded-3xl p-6 h-[600px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50" />
            <h3 className="font-mono text-sm tracking-widest text-purple-300 mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> SECURE AUDIT LOG
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 font-mono text-xs">
              {isLoading && (
                <div className="flex items-center gap-3 text-purple-200 p-3 bg-purple-400/10 rounded-lg border border-purple-400/20">
                  <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-2 rounded-full bg-purple-300 shadow-[0_0_5px_rgba(192,132,252,0.6)]" />
                  Orchestrator establishing node connections...
                </div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-start shadow-inner">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    transition={{ duration: 0.4, type: "spring" }}
                    key={i}
                    className="p-3 rounded-lg bg-black/30 border border-purple-300/10 text-neutral-300 relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400/50 rounded-l-lg" />
                    <div className="pl-3 py-1">
                      <span className="text-purple-50">{msg}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!isLoading && messages.length === 0 && !error && (
                <div className="h-full flex items-center justify-center text-neutral-500">AWAITING_INPUT_STREAM_</div>
              )}
            </div>
          </div>

          {/* Artifacts */}
          <div className="lg:col-span-8 glass-panel rounded-3xl p-8 h-[600px] flex flex-col overflow-y-auto">
            <h3 className="font-bold text-2xl text-white mb-8 border-b border-purple-300/20 pb-4">Synthesized Artifacts</h3>

            {socialPosts.length > 0 && (
              <div className="mb-12">
                <h4 className="text-sm font-bold text-purple-300 mb-4 tracking-widest uppercase flex items-center gap-2"><Share2 className="w-4 h-4 text-purple-400" /> Content Outputs</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {socialPosts.map((post, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-300/15">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold bg-purple-400/20 text-purple-200 px-3 py-1 rounded-full uppercase tracking-wide">{post.platform}</span>
                        <span className="text-xs text-neutral-400 font-mono">{post.release_time}</span>
                      </div>
                      <p className="text-sm text-neutral-200 leading-relaxed font-light">{post.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {schedule.length > 0 && (
              <div className="mb-12">
                <h4 className="text-sm font-bold text-violet-300 mb-4 tracking-widest uppercase flex gap-2"><Calendar className="w-4 h-4 text-violet-400" /> Schedule</h4>
                <div className="space-y-3">
                  {schedule.map((item, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-gradient-to-r from-violet-900/10 to-transparent border border-violet-300/15">
                      <span className="text-md font-bold text-white">{item.title}</span>
                      <span className="text-sm text-neutral-400 ml-2">{item.start_time} — {item.speaker}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {emails.length > 0 && (
              <div className="mb-12">
                <h4 className="text-sm font-bold text-indigo-300 mb-4 tracking-widest uppercase flex gap-2"><Send className="w-4 h-4 text-indigo-400" /> Emails</h4>
                <div className="grid grid-cols-1 gap-4">
                  {emails.map((email, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/10 to-transparent border border-indigo-300/15">
                      <div className="text-xs text-indigo-300/70 font-mono mb-1">TO: {email.email}</div>
                      <div className="text-sm font-bold text-white mb-2">{email.personalized_subject}</div>
                      <div className="text-sm text-neutral-400 whitespace-pre-wrap">{email.personalized_body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {logisticsPlan && (
              <div className="mb-12">
                <h4 className="text-sm font-bold text-emerald-300 mb-4 tracking-widest uppercase flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Logistics</h4>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/10 to-transparent border border-emerald-300/15">
                  <p className="text-2xl font-black text-white mb-4">{logisticsPlan.estimated_budget}</p>
                  <p className="text-sm text-neutral-300 mb-2">{logisticsPlan.catering_suggestion}</p>
                  <p className="text-sm text-neutral-300">{logisticsPlan.swag_package}</p>
                </div>
              </div>
            )}

            {!isLoading && !socialPosts.length && !schedule.length && !emails.length && !logisticsPlan && (
              <div className="flex-1 flex flex-col items-center justify-center text-purple-200/20">
                <Database className="w-16 h-16 mb-4 opacity-40" />
                <p className="font-mono text-sm text-purple-200/40">NO_DATA_GENERATED</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
