"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../auth-context";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Plus, Trash2, Calendar, AlertCircle } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

interface Reminder {
  id: string;
  event_id: string;
  message: string;
  scheduled_time: string;
  sent: boolean;
}

interface EventOption {
  id: string;
  title: string;
}

export default function RemindersPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) fetchEvents();
  }, [token]);

  useEffect(() => {
    if (token && selectedEvent) fetchReminders(selectedEvent);
  }, [token, selectedEvent]);

  const fetchEvents = async () => {
    const res = await fetch(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
      if (data.length > 0) setSelectedEvent(data[0].id);
    }
  };

  const fetchReminders = async (eventId: string) => {
    const res = await fetch(`${API_BASE}/reminders/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setReminders(await res.json());
  };

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !message || !scheduledTime) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reminders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          event_id: selectedEvent, 
          message, 
          scheduled_time: scheduledTime,
          smtp_user: smtpUser,
          smtp_password: smtpPassword
        }),
      });
      if (!res.ok) throw new Error("Failed to create reminder");
      const newReminder = await res.json();
      setReminders((prev) => [...prev, newReminder]);
      setMessage("");
      setScheduledTime("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteReminder = async (id: string) => {
    await fetch(`${API_BASE}/reminders/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setReminders(reminders.filter((r) => r.id !== id));
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
      </div>

      <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Bell className="w-5 h-5 text-purple-300" />
        <span className="font-bold text-white">OrgaNexus | Event Reminders</span>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Create Reminder */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-3xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-300" /> New Reminder
          </h2>
          
          {events.length === 0 ? (
            <p className="text-neutral-400 text-sm">Create an event first to set reminders.</p>
          ) : (
            <form onSubmit={createReminder} className="space-y-4">
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
                <label className="block text-sm text-neutral-400 mb-1.5">Reminder Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none h-20 shadow-inner placeholder-neutral-500"
                  placeholder="e.g. Don't forget to check in at Registration Desk B..."
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">Scheduled Time</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 shadow-inner"
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
                disabled={loading}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(192,132,252,0.3)] disabled:opacity-50"
              >
                Create Reminder
              </button>
            </form>
          )}
        </motion.div>

        {/* List Reminders */}
        <div className="space-y-3">
          {reminders.length === 0 && selectedEvent && (
            <p className="text-neutral-500 text-center py-8">No reminders for this event yet.</p>
          )}
          {reminders.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl p-5 flex items-start justify-between gap-4 border border-white/5"
            >
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-purple-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">{r.message}</p>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">
                    {new Date(r.scheduled_time).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteReminder(r.id)}
                className="text-neutral-500 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
