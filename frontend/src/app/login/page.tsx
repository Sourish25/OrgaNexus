"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../auth-context";
import { useRouter } from "next/navigation";
import { BrainCircuit, LogIn, UserPlus, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
        <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-violet-400/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <BrainCircuit className="w-8 h-8 text-purple-300" />
          <span className="font-bold text-2xl text-neutral-100 tracking-wide">
            Orga<span className="text-purple-300 font-black">Nexus</span>
          </span>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-3xl p-8 border border-white/10">
          <h2 className="text-2xl font-black text-white mb-2 text-center">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-neutral-400 text-sm text-center mb-8">
            {isRegister ? "Set up your organizer profile" : "Sign in to your organizer dashboard"}
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex gap-2 items-center mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 transition-colors shadow-inner placeholder-neutral-500"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 transition-colors shadow-inner placeholder-neutral-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-black/40 border border-purple-300/20 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400 transition-colors shadow-inner placeholder-neutral-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:shadow-[0_0_30px_rgba(192,132,252,0.5)] disabled:opacity-50"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <BrainCircuit className="w-5 h-5" />
                </motion.div>
              ) : isRegister ? (
                <><UserPlus className="w-5 h-5" /> Create Account</>
              ) : (
                <><LogIn className="w-5 h-5" /> Sign In</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-sm text-purple-300 hover:text-purple-200 transition-colors"
            >
              {isRegister ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              <ArrowRight className="w-3 h-3 inline ml-1" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
