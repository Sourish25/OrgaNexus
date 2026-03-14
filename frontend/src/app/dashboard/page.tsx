"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../auth-context";
import { useRouter } from "next/navigation";
import { BrainCircuit, Plus, Calendar, Share2, Send, CheckCircle2, Trash2, LogOut, LayoutDashboard, MessageCircle, Bell, Mail, ChevronRight, Zap } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

interface EventSummary {
  id: string;
  title: string;
  created_at: string;
  has_social_posts: boolean;
  has_schedule: boolean;
  has_emails: boolean;
  has_logistics: boolean;
}

export default function DashboardPage() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) fetchEvents();
  }, [token]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch events:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm("Are you sure you want to permanently delete this event? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      console.log(`[Dashboard] Attempting to delete event: ${id}`);
      const res = await fetch(`${API_BASE}/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to delete event");
      }
      
      console.log(`[Dashboard] Successfully deleted event: ${id}`);
      setEvents((prev) => prev.filter((evt) => evt.id !== id));
    } catch (err: any) {
      console.error("[Dashboard] Delete failed:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) return null;

  const navItems = [
    { icon: LayoutDashboard, label: "Events", href: "/dashboard", active: true },
    { icon: Zap, label: "New Swarm", href: "/dashboard/swarm" },
    { icon: MessageCircle, label: "Chatbot", href: "/dashboard/chatbot" },
    { icon: Bell, label: "Reminders", href: "/dashboard/reminders" },
    { icon: Mail, label: "Emails", href: "/dashboard/emails" },
  ];

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-6 h-6 text-purple-300" />
          <span className="font-bold text-neutral-100 tracking-wide">
            Orga<span className="text-purple-300 font-black">Nexus</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-2 transition-colors ${item.active ? "text-purple-300 font-medium" : "text-neutral-400 hover:text-purple-200"}`}
            >
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-400 hidden sm:block">
            {user.name}
          </span>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="p-2 text-neutral-400 hover:text-red-300 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black text-white mb-1">Your Events</h1>
            <p className="text-neutral-400 text-sm">Manage your organized events and AI-generated plans</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/swarm")}
            className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:shadow-[0_0_30px_rgba(192,132,252,0.5)]"
          >
            <Plus className="w-5 h-5" /> New Event
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <BrainCircuit className="w-8 h-8 text-purple-300" />
            </motion.div>
          </div>
        ) : events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-16 text-center"
          >
            <LayoutDashboard className="w-16 h-16 text-purple-300/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No events yet</h3>
            <p className="text-neutral-400 mb-6">Create your first event to get started with AI-powered logistics.</p>
            <button
              onClick={() => router.push("/dashboard/swarm")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(192,132,252,0.3)]"
            >
              <Zap className="w-5 h-5" /> Configure Your First Swarm
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel glass-panel-hover rounded-2xl p-6 relative group cursor-pointer"
                  onClick={() => router.push(`/dashboard/event/${event.id}`)}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-300/10 rounded-bl-full blur-[30px] group-hover:bg-purple-300/20 transition-colors" />

                  <h3 className="text-lg font-bold text-white mb-1 relative z-10 pr-8">{event.title}</h3>
                  <p className="text-xs text-neutral-500 mb-4 font-mono">
                    {new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2 mb-4 relative z-10">
                    {event.has_social_posts && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-200 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Posts
                      </span>
                    )}
                    {event.has_schedule && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Schedule
                      </span>
                    )}
                    {event.has_emails && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 flex items-center gap-1">
                        <Send className="w-3 h-3" /> Emails
                      </span>
                    )}
                    {event.has_logistics && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Logistics
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-xs text-purple-300 flex items-center gap-1 group-hover:text-purple-200 transition-colors">
                      View details <ChevronRight className="w-3 h-3" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => deleteEvent(event.id, e)}
                      className="relative z-20 p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100 mb-1"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
