"use client";

import { useState, useEffect, useRef, use } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../../auth-context";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Share2, Calendar, Send, CheckCircle2, AlertCircle,
  Layers, Database, ShieldCheck, MessageSquare, RefreshCw,
  DollarSign, Users, Clock, Zap, Sparkles, Newspaper, TrendingUp, Target, Briefcase, Activity
} from "lucide-react";

const API_BASE = "http://localhost:8000/api";

interface ChatMessage {
  id: string;
  role: "user" | "orchestrator";
  content: string;
  timestamp: string;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "initial", role: "orchestrator", content: "I'm your AI orchestrator. How can I assist with this event today?", timestamp: new Date().toISOString() }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "logistics" | "roi">("overview"); // New tab state
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  
  // Credentials Update State
  const [editConfig, setEditConfig] = useState(false);
  const [instaAccessToken, setInstaAccessToken] = useState("");
  const [twitterBearerToken, setTwitterBearerToken] = useState("");
  const [linkedinAccessToken, setLinkedinAccessToken] = useState("");
  const [linkedinPersonUrn, setLinkedinPersonUrn] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  
  // Pulse State
  const [isPulsing, setIsPulsing] = useState<"none" | "red" | "green">("none");
  const [simulatingDrift, setSimulatingDrift] = useState(false);
  const [recapAttendee, setRecapAttendee] = useState("");
  const [generatingRecap, setGeneratingRecap] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token && id) {
      fetchEvent();
      fetchChatHistory();
    }
  }, [token, id]);

  useEffect(() => {
    if (event && event.inputs) {
      const inputs = event.inputs;
      if (inputs.instagram_config?.access_token) setInstaAccessToken(inputs.instagram_config.access_token);
      if (inputs.twitter_config?.bearer_token) setTwitterBearerToken(inputs.twitter_config.bearer_token);
      if (inputs.linkedin_config?.access_token) setLinkedinAccessToken(inputs.linkedin_config.access_token);
      if (inputs.linkedin_config?.person_urn) setLinkedinPersonUrn(inputs.linkedin_config.person_urn);
      if (inputs.smtp_config?.smtp_user) setSmtpUser(inputs.smtp_config.smtp_user);
      if (inputs.smtp_config?.smtp_password) setSmtpPassword(inputs.smtp_config.smtp_password);
    }
  }, [event]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`${API_BASE}/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEvent(await res.json());
      else router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const history = await res.json();
        // Filter out the initial assistant message if history exists
        if (history.length > 0) {
          setMessages(history);
        }
      }
    } catch { /* ignore */ }
  };

  const sendMessage = async (msg?: string) => {
    const text = msg || inputMessage.trim();
    if (!text || chatLoading) return;
    setInputMessage("");

    // Optimistic user message
    const tempMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/orchestrator/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ event_id: id, message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "orchestrator",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsg]);

        // If the event was updated, refresh it
        if (data.updated_event) {
          setEvent(data.updated_event);
        } else if (data.action_taken) {
          // Refresh event data for any action
          fetchEvent();
        }
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "orchestrator",
        content: "Sorry, I couldn't process that. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePublishInstagram = async (index: number) => {
    setPublishingIndex(index);
    try {
      const res = await fetch(`${API_BASE}/social/publish-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ event_id: id, post_index: index }),
      });

      if (res.ok) {
        alert("Published to Instagram successfully! 🚀");
        fetchEvent(); // Refresh to show "Published" status
      } else {
        const data = await res.json();
        alert("Failed to publish: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      alert("Error publishing: " + err);
    } finally {
      setPublishingIndex(null);
    }
  };

  const handlePublishTwitter = async (index: number) => {
    setPublishingIndex(index);
    try {
      const res = await fetch(`${API_BASE}/social/publish-twitter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_id: id, post_index: index }),
      });
      if (res.ok) { alert("Published to Twitter successfully! 🐦"); fetchEvent(); }
      else { const data = await res.json(); alert("Failed to publish: " + (data.detail || "Unknown error")); }
    } catch { alert("Error publishing Twitter"); } finally { setPublishingIndex(null); }
  };

  const handlePublishLinkedIn = async (index: number) => {
    setPublishingIndex(index);
    try {
      const res = await fetch(`${API_BASE}/social/publish-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_id: id, post_index: index }),
      });
      if (res.ok) { alert("Published to LinkedIn successfully! 💼"); fetchEvent(); }
      else { const data = await res.json(); alert("Failed to publish: " + (data.detail || "Unknown error")); }
    } catch { alert("Error publishing LinkedIn"); } finally { setPublishingIndex(null); }
  };

  const updateConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/events/${id}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          instagram_access_token: instaAccessToken || undefined,
          twitter_bearer_token: twitterBearerToken || undefined,
          linkedin_access_token: linkedinAccessToken || undefined,
          linkedin_person_urn: linkedinPersonUrn,
          smtp_user: smtpUser || undefined,
          smtp_password: smtpPassword || undefined,
        }),
      });
      if (res.ok) { alert("Platform credentials updated!"); setEditConfig(false); fetchEvent(); }
      else { alert("Failed to update credentials."); }
    } catch { alert("Failed to update credentials."); }
  };

  const simulateDrift = async (driftMessage: string) => {
    setSimulatingDrift(true);
    setIsPulsing("red");
    try {
      const res = await fetch(`${API_BASE}/events/${id}/pulse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ drift_message: driftMessage }),
      });
      if (res.ok) {
        setIsPulsing("green");
        await fetchEvent();
        setTimeout(() => setIsPulsing("none"), 3000);
      } else {
        setIsPulsing("none");
        alert("Failed to simulate drift.");
      }
    } catch (err) {
      setIsPulsing("none");
      alert("Error: " + err);
    } finally {
      setSimulatingDrift(false);
    }
  };

  const handleGenerateRecap = async () => {
    if (!recapAttendee.trim()) return;
    setGeneratingRecap(true);
    try {
      const res = await fetch(`${API_BASE}/events/${id}/recap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attendee_name: recapAttendee.trim() }),
      });
      if (res.ok) {
        await fetchEvent();
        setRecapAttendee("");
        alert("Personalized recap generated successfully!");
      } else {
        alert("Failed to generate recap.");
      }
    } catch (err) {
      alert("Error: " + err);
    } finally {
      setGeneratingRecap(false);
    }
  };

  if (authLoading || !user || loading) return null;
  if (!event) return null;

  const results = event.results || {};
  const inputs = event.inputs || {};
  const socialPosts = results.social_media_posts || [];
  const schedule = results.master_schedule || [];
  const emails = results.sent_emails || [];
  const logisticsPlan = results.logistics_plan;
  const pressRelease = results.press_release;
  const roiSummary = results.roi_summary; // Added roiSummary
  const pulseEvents = results.pulse_events || [];
  const postPulseRecaps = results.post_pulse_recaps || {};

  const quickActions = [
    "Summarize this event",
    "What's the current budget?",
    "Regenerate social media posts",
    "Write a press release",
    "Calculate event ROI",
    "Suggest improvements",
  ];

  return (
    <motion.div 
      className="min-h-screen relative transition-colors duration-1000"
      animate={{
        backgroundColor: isPulsing === "red" ? "rgba(220, 38, 38, 0.05)" : isPulsing === "green" ? "rgba(22, 163, 74, 0.05)" : "transparent"
      }}
    >
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <motion.div 
          className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full blur-[130px]" 
          animate={{
            backgroundColor: isPulsing === "red" ? "rgba(220, 38, 38, 0.2)" : isPulsing === "green" ? "rgba(22, 163, 74, 0.2)" : "rgba(192, 132, 252, 0.1)",
            scale: isPulsing !== "none" ? [1, 1.05, 1] : 1
          }}
          transition={{ repeat: isPulsing === "red" ? Infinity : 0, duration: 1.5 }}
        />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Layers className="w-5 h-5 text-purple-300" />
        <span className="font-bold text-white truncate">{event.title}</span>
        <div className="ml-2 px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-200 text-[10px] uppercase font-bold tracking-wider">OrgaNexus</div>
        <span className="text-xs text-neutral-500 font-mono ml-auto">
          {new Date(event.created_at).toLocaleDateString()}
        </span>
      </nav>

      {/* Event Summary Stats */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: Share2, label: "Social Posts", value: socialPosts.length, color: "purple" },
            { icon: Calendar, label: "Schedule Items", value: schedule.length, color: "violet" },
            { icon: Send, label: "Emails", value: emails.length, color: "indigo" },
            { icon: DollarSign, label: "Budget", value: logisticsPlan?.estimated_budget || "—", color: "emerald" },
            { icon: Clock, label: "Updated", value: event.updated_at ? new Date(event.updated_at).toLocaleDateString() : "—", color: "neutral" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">{stat.label}</span>
              </div>
              <span className="text-lg font-bold text-white">{stat.value}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1 inline-flex mt-6 relative z-20">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === "overview" ? "bg-white/10 text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <Layers className="w-4 h-4" /> Content & Comms
            </button>
            <button
              onClick={() => setActiveTab("logistics")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === "logistics" ? "bg-blue-500/20 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-500/30" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <Database className="w-4 h-4" /> Logistics & Press
            </button>
            <button
              onClick={() => setActiveTab("roi")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === "roi" ? "bg-amber-500/20 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)] border border-amber-500/30" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <TrendingUp className="w-4 h-4" /> ROI & Management
            </button>
          </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 w-full mt-6">

            {/* Main content column - changes based on tab */}
            <div className="col-span-1 lg:col-span-2 space-y-6">

            {/* Error */}
            {results.current_error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{results.current_error}</p>
              </div>
            )}

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <>
                {/* Event Overview — What is this event? */}
                {(inputs.event_details || inputs.scheduling_constraints || inputs.email_draft_base) && (
                  <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-40" />
                    <h4 className="text-sm font-bold text-cyan-300 tracking-widest uppercase flex items-center gap-2 mb-4">
                      <Layers className="w-4 h-4 text-cyan-400" /> Event Overview
                    </h4>
                    {inputs.event_details && (
                      <div className="mb-4">
                        <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-2 font-bold">About This Event</span>
                        <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-cyan-300/10">
                          {inputs.event_details}
                        </div>
                      </div>
                    )}
                    {inputs.scheduling_constraints && (
                      <div className="mb-4">
                        <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-2 font-bold">Scheduling Notes</span>
                        <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-violet-300/10">
                          {inputs.scheduling_constraints}
                        </div>
                      </div>
                    )}
                    {inputs.email_draft_base && (
                      <div>
                        <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-2 font-bold">Email Template</span>
                        <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-indigo-300/10">
                          {inputs.email_draft_base}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Configuration Panel (New) */}
                <div className="glass-panel rounded-3xl p-6 relative overflow-hidden border border-amber-500/10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-amber-300 tracking-widest uppercase flex items-center gap-2">
                       Platform Connections
                    </h4>
                    <button onClick={() => setEditConfig(!editConfig)} className="relative z-10 text-xs px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 hover:bg-amber-400/20 transition-colors">
                      {editConfig ? "Cancel" : "Manage"}
                    </button>
                  </div>

                  {editConfig ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="password" value={instaAccessToken} onChange={(e) => setInstaAccessToken(e.target.value)} placeholder="Instagram Access Token" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                        <input type="password" value={twitterBearerToken} onChange={(e) => setTwitterBearerToken(e.target.value)} placeholder="Twitter Bearer Token" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                        <input type="password" value={linkedinAccessToken} onChange={(e) => setLinkedinAccessToken(e.target.value)} placeholder="LinkedIn Access Token" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                        <input type="text" value={linkedinPersonUrn} onChange={(e) => setLinkedinPersonUrn(e.target.value)} placeholder="LinkedIn Person URN" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                        <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="SMTP User" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                        <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="SMTP Password" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white" />
                      </div>
                      <button onClick={updateConfig} className="w-full py-2 bg-amber-500 text-neutral-900 rounded-xl text-xs font-bold">Update Config</button>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      {inputs.instagram_config?.access_token ? (<div className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3" /> Insta Connected</div>) : (<div className="text-neutral-500 text-xs">Insta Locked</div>)}
                      {inputs.twitter_config?.bearer_token ? (<div className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3" /> Twitter Connected</div>) : (<div className="text-neutral-500 text-xs">Twitter Locked</div>)}
                      {inputs.linkedin_config?.access_token ? (<div className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3" /> LinkedIn Connected</div>) : (<div className="text-neutral-500 text-xs">LinkedIn Locked</div>)}
                    </div>
                  )}
                </div>

                {/* Social Posts */}
                <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-40" />
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-purple-300 tracking-widest uppercase flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-purple-400" /> Content Outputs
                    </h4>
                    <button onClick={() => sendMessage("Regenerate social media posts")}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-purple-400/10 text-purple-300 border border-purple-400/20 hover:bg-purple-400/20 transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                  {socialPosts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {socialPosts.map((post: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-300/15 hover:border-purple-300/30 transition-colors relative group">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex gap-2 items-center">
                              <span className="text-[10px] font-bold bg-purple-400/20 text-purple-200 px-2.5 py-0.5 rounded-full uppercase tracking-wide">{post.platform}</span>
                              {post.published && (
                                <span className="text-[10px] font-bold bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Published
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono">{post.release_time}</span>
                          </div>

                          {post.image_url && (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3 border border-white/5">
                              <img
                                src={post.image_url}
                                alt="Visual Asset"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e: any) => {
                                  e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop";
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                          )}

                          <p className="text-sm text-neutral-200 leading-relaxed font-light mb-4">{post.copy}</p>

                          {post.platform.toLowerCase() === "instagram" && !post.published && (
                            <button
                              onClick={() => handlePublishInstagram(i)}
                              disabled={publishingIndex !== null}
                              className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/30 text-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:border-purple-400/60"
                            >
                              {publishingIndex === i ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Publishing...</>
                              ) : (
                                <><Share2 className="w-3 h-3" /> Post to Instagram</>
                              )}
                            </button>
                          )}

                          {post.platform.toLowerCase() === "twitter" && !post.published && (
                            <button
                              onClick={() => handlePublishTwitter(i)}
                              disabled={publishingIndex !== null}
                              className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:border-cyan-400/60"
                            >
                              {publishingIndex === i ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Publishing...</>
                              ) : (
                                <><Share2 className="w-3 h-3" /> Post to Twitter</>
                              )}
                            </button>
                          )}

                          {post.platform.toLowerCase() === "linkedin" && !post.published && (
                            <button
                              onClick={() => handlePublishLinkedIn(i)}
                              disabled={publishingIndex !== null}
                              className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 text-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:border-blue-400/60"
                            >
                              {publishingIndex === i ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Publishing...</>
                              ) : (
                                <><Share2 className="w-3 h-3" /> Post to LinkedIn</>
                              )}
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm text-center py-6">No social posts generated yet. Ask the orchestrator to create some!</p>
                  )}
                </div>

                {/* Schedule */}
                <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-40" />
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-violet-300 tracking-widest uppercase flex gap-2">
                      <Calendar className="w-4 h-4 text-violet-400" /> Schedule
                    </h4>
                    <button onClick={() => sendMessage("Regenerate the schedule")}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-violet-400/10 text-violet-300 border border-violet-400/20 hover:bg-violet-400/20 transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                  {schedule.length > 0 ? (
                    <div className="relative pl-6 border-l-2 border-violet-400/20 space-y-4">
                      {schedule.map((item: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="relative">
                          <div className="absolute -left-[31px] top-2 w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-900/10 to-transparent border border-violet-300/10 hover:border-violet-300/25 transition-colors">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs font-mono text-violet-200 font-bold">
                                {item.start_time}{item.end_time ? ` - ${item.end_time}` : ""}
                              </span>
                              {item.location && <span className="text-[10px] text-neutral-500 uppercase bg-white/5 px-2 py-0.5 rounded-full">{item.location}</span>}
                            </div>
                            <span className="text-sm font-bold text-white">{item.title}</span>
                            {item.speaker && (
                              <span className="text-xs text-neutral-400 block mt-0.5">
                                <Users className="w-3 h-3 inline mr-1" />{item.speaker}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm text-center py-6">No schedule generated yet. Ask the orchestrator to create one!</p>
                  )}
                </div>

                {/* Emails */}
                {emails.length > 0 && (
                  <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-40" />
                    <h4 className="text-sm font-bold text-indigo-300 mb-4 tracking-widest uppercase flex gap-2">
                      <Send className="w-4 h-4 text-indigo-400" /> Emails ({emails.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {emails.map((email: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/10 to-transparent border border-indigo-300/15 hover:border-indigo-300/30 transition-colors relative">
                          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                          <div className="text-xs text-indigo-300/70 font-mono mb-1.5">{email.email}</div>
                          <div className="text-sm font-bold text-white mb-2 tracking-wide">{email.personalized_subject}</div>
                          <div className="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed border-t border-indigo-300/10 pt-2 line-clamp-3">{email.personalized_body}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* LOGISTICS TAB */}
            {activeTab === "logistics" && (
              <>
                {/* Logistics Plan */}
                <div className="glass-panel p-6 border-blue-500/20 shadow-[0_4px_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 relative z-10 w-full flex-wrap gap-4">
                    <div>
                      <h3 className="text-xl font-light text-white flex items-center gap-3">
                        <Database className="w-5 h-5 text-blue-400" /> Complete Master Logistics Plan
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">AI-generated operational blueprint.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button onClick={() => simulateDrift("Speaker Late 15m")} disabled={simulatingDrift}
                        className="text-[10px] px-2.5 py-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 font-bold">
                        <Activity className="w-3.5 h-3.5" /> [Drift: Late 15m]
                      </button>
                      <button onClick={() => simulateDrift("Leak in Room 302. Need to change room.")} disabled={simulatingDrift}
                        className="text-[10px] px-2.5 py-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 font-bold">
                        <Activity className="w-3.5 h-3.5" /> [Drift: Leak Room 302]
                      </button>
                      <button onClick={() => sendMessage("Regenerate the logistics plan based on the current constraints")}
                          className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5" /> Force Refresh
                      </button>
                    </div>
                  </div>

                  {logisticsPlan ? (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/10 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-blue-200 mb-1">Estimated Budget Request</h4>
                          <p className="text-2xl font-light text-white">{logisticsPlan.estimated_budget}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass-panel p-4 bg-white/[0.02]">
                          <h4 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400/70" /> Prep Timeline & Catering
                          </h4>
                          <div className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
                            {logisticsPlan.catering_suggestion}
                          </div>
                        </div>
                        <div className="glass-panel p-4 bg-red-950/20 border-red-500/10 flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-red-300 mb-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> Critical Bottlenecks
                            </h4>
                            <ul className="space-y-2 mb-4">
                              {logisticsPlan.critical_bottlenecks?.map((neck: string, i: number) => (
                                <li key={i} className="text-sm text-red-200/70 flex items-start gap-2">
                                  <span className="text-red-500 mt-0.5">•</span> {neck}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {(pulseEvents && pulseEvents.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-red-500/10">
                              <h4 className="text-xs uppercase font-bold text-red-400 mb-2 flex gap-1 items-center">
                                <Activity className="w-3 h-3 animate-pulse" /> Active pulse Events
                              </h4>
                              <ul className="space-y-1">
                                {pulseEvents.map((pulse: string, i: number) => (
                                  <li key={i} className="text-xs text-red-200/80 bg-red-500/10 px-2 py-1 rounded inline-block mb-1 mr-1 border border-red-500/20">
                                    {pulse}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm text-center py-6">No logistics plan yet. Ask the orchestrator to create one!</p>
                  )}
                </div>

                {/* Press Release */}
                {pressRelease && (
                  <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-40" />
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-blue-300 tracking-widest uppercase flex gap-2">
                        <Newspaper className="w-4 h-4 text-blue-400" /> AP Style Press Release
                      </h4>
                      <button onClick={() => sendMessage("Regenerate the press release")}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-blue-400/10 text-blue-300 border border-blue-400/20 hover:bg-blue-400/20 transition-colors flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                    </div>

                    <div className="bg-gradient-to-br from-blue-900/10 to-transparent border border-blue-300/10 rounded-2xl p-5 relative">
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
                      <div className="text-sm text-neutral-200 leading-relaxed font-serif whitespace-pre-wrap">
                        <div dangerouslySetInnerHTML={{ __html: pressRelease.replace(/\*\*(.*?)\*\*/g, '<span class="text-blue-200 font-bold">$1</span>') }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ROI & MANAGER TAB */}
            {activeTab === "roi" && (
              <>
                {/* ROI Manager Overview */}
                <div className="glass-panel p-6 border-amber-500/20 shadow-[0_4px_30px_rgba(245,158,11,0.1)] relative overflow-hidden min-h-[500px]">
                  <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />

                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 relative z-10">
                    <div>
                      <h3 className="text-xl font-light text-white flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-amber-400" /> ROI & Executive Summary
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">Management insights synthesized from event parameters.</p>
                    </div>
                    <button onClick={() => sendMessage("Regenerate the ROI summary")}
                        className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 z-10">
                        <RefreshCw className="w-3.5 h-3.5" /> Re-calculate
                    </button>
                  </div>

                  {roiSummary ? (
                    <div className="space-y-6 relative z-10">

                      {/* Top Metric Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/30 to-black/40 border border-amber-500/10">
                          <h4 className="text-xs font-bold text-amber-500/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                             <Target className="w-3.5 h-3.5" /> Estimated ROI
                          </h4>
                          <p className="text-sm text-amber-100 font-medium leading-relaxed">{roiSummary.roi_estimation}</p>
                        </div>

                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                           <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                             <Briefcase className="w-3.5 h-3.5" /> Participant Demographics
                          </h4>
                          <div className="flex items-end gap-3 mb-2">
                              <span className="text-3xl font-light text-white">{roiSummary.detailed_participation?.total_attendees || "N/A"}</span>
                              <span className="text-sm text-neutral-400 mb-1">Total Expected</span>
                          </div>
                          <p className="text-xs text-neutral-400">{roiSummary.detailed_participation?.key_demographics}</p>
                        </div>
                      </div>

                      {/* Exec Summary */}
                      <div className="glass-panel p-5 bg-white/[0.01]">
                        <h4 className="text-sm font-semibold text-white mb-3">Executive Summary</h4>
                        <p className="text-sm text-neutral-300 leading-loose">
                           {roiSummary.executive_summary}
                        </p>
                      </div>

                      {/* Improvements */}
                      <div className="glass-panel p-5 border-emerald-500/10 bg-emerald-950/10">
                        <h4 className="text-sm font-semibold text-emerald-300 mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4 flex-shrink-0" /> Future Strategic Improvements for Management
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                           {roiSummary.future_improvements?.map((imp: string, i: number) => (
                             <div key={i} className="flex gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                               <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                 {i + 1}
                               </div>
                               <p className="text-sm text-neutral-300 pt-0.5">{imp}</p>
                             </div>
                           ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 opacity-50">
                       <TrendingUp className="w-12 h-12 text-amber-500/50 mb-4" />
                       <p className="text-center text-sm text-neutral-400 max-w-sm">
                         No ROI data yet. Ensure you have registration data and an AI logistics plan generated, then ask the AI to calculate ROI.
                       </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Left sidebar - Chat Interface - dynamically styled based on tab */}
          <div className="col-span-1 border-r border-white/5 pr-0 lg:pr-6 flex flex-col pt-4 order-last lg:order-first lg:sticky lg:top-20 h-fit">
            <h3 className={`text-lg font-light flex items-center gap-2 mb-4 ${activeTab === "roi" ? "text-amber-200" : "text-white"}`}>
              {activeTab === "roi" ? (
                <><Briefcase className="w-4 h-4 text-amber-400" /> Event Manager Assistant</>
              ) : (
                <><Sparkles className="w-4 h-4 text-purple-400" /> The Orchestrator</>
              )}
            </h3>

            <div className={`glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-160px)] h-fit ${activeTab === "roi" ? "border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)] bg-amber-950/5" : ""}`}>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-purple-400/40" />
                    </div>
                    <p className="text-neutral-400 text-sm mb-1">Chat with the Orchestrator</p>
                    <p className="text-neutral-600 text-xs mb-6">Ask questions, modify your event, or regenerate outputs</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {quickActions.map((action, i) => (
                        <button key={i} onClick={() => sendMessage(action)}
                          className="text-xs px-3 py-1.5 rounded-full bg-purple-400/10 text-purple-300 border border-purple-400/20 hover:bg-purple-400/20 transition-colors">
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-500/20 text-purple-100 border border-purple-400/20"
                        : "bg-white/5 text-neutral-200 border border-white/10"
                    }`}>
                      {(msg.role === "orchestrator") && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${activeTab === 'roi' ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'}`}>
                            {activeTab === 'roi' ? 'Manager AI' : 'Orchestrator'}
                          </span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                        <span className="text-xs text-neutral-500">Thinking...</span>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Quick Actions (shown when there's history) */}
              {messages.length > 0 && (
                <div className="px-4 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {quickActions.map((action, i) => (
                    <button key={i} onClick={() => sendMessage(action)} disabled={chatLoading}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-purple-400/10 text-purple-300/70 border border-purple-400/10 hover:bg-purple-400/20 transition-colors whitespace-nowrap shrink-0">
                      {action}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Input Area */}
              <div className={`p-4 pb-5 border-t bg-black/20 ${activeTab === 'roi' ? 'border-amber-500/20' : 'border-white/5'}`}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={activeTab === 'roi' ? "Ask management & strategic questions..." : "Ask the orchestrator..."}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <button onClick={() => sendMessage()} disabled={chatLoading || !inputMessage.trim()}
                    className={`absolute right-1 w-8 h-8 flex items-center justify-center rounded-full transition-all disabled:opacity-30 ${activeTab === 'roi' ? 'bg-amber-500 hover:bg-amber-400 text-amber-950' : 'bg-purple-500 hover:bg-purple-400 text-white'}`}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'roi' ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`} />
                    <span className="text-[10px] text-neutral-500 font-medium">Orchestrator Online</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${activeTab === 'roi' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'} ml-2`}>
                      Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
