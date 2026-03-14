"use client";

import { useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useAuth } from "./auth-context";
import { useRouter } from "next/navigation";
import { BrainCircuit, ArrowRight, Cpu, Zap, ShieldCheck, Database, Layers, Share2, Calendar, Send, CheckCircle2 } from "lucide-react";

const ParticleBackground = () => (
  <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-dot-pattern flex justify-center">
    <div className="absolute top-[-20%] w-[1000px] h-[1000px] rounded-full bg-purple-400/10 blur-[130px]" />
    <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-violet-400/10 blur-[120px]" />
  </div>
);

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  const features = [
    { icon: Share2, title: "Content Strategist", desc: "AI-generated promotional content with optimal release scheduling.", color: "purple" },
    { icon: Calendar, title: "Dynamic Scheduler", desc: "Autonomous conflict resolution across temporal and spatial constraints.", color: "violet" },
    { icon: Send, title: "Comms Distributor", desc: "Mass-personalization engine for targeted event communications.", color: "indigo" },
    { icon: CheckCircle2, title: "Logistics & Budget", desc: "AI-driven catering, swag, and budget optimization.", color: "emerald" },
  ];

  return (
    <div className="min-h-screen selection:bg-purple-300/30 font-sans">
      <ParticleBackground />

      {/* Floating Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-full px-8 py-4 flex items-center gap-12 border border-white/15 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-6 h-6 text-purple-300" />
          <span className="font-bold text-neutral-100 tracking-wide">
            Orga<span className="text-purple-300 font-black">Nexus</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400 border-l border-white/10 pl-8">
          <a href="#features" className="hover:text-purple-200 transition-colors flex items-center gap-2"><Cpu className="w-4 h-4" /> Nodes</a>
          <a href="#how" className="hover:text-purple-200 transition-colors flex items-center gap-2"><Layers className="w-4 h-4" /> How it works</a>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="bg-white/90 text-purple-950 px-5 py-2 rounded-full text-sm font-bold hover:bg-white transition-colors shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]"
        >
          Get Started
        </button>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-40 px-4 text-center overflow-hidden">
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="z-10 flex flex-col items-center max-w-4xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-8 px-5 py-2 rounded-full border border-purple-300/30 bg-purple-400/10 text-purple-200 text-sm font-mono tracking-widest uppercase flex items-center gap-3 shadow-[0_0_20px_rgba(192,132,252,0.1)]"
          >
            <span className="flex h-2 w-2 rounded-full bg-purple-300 animate-pulse" />
            Multi-Agent Node Architecture Active
          </motion.div>

          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-100 to-purple-200 tracking-tight leading-tight mb-8 neon-text-purple"
          >
            Logistics, <br /> autonomously solved.
          </motion.h1>

          <motion.p
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-neutral-300 max-w-3xl mb-12 leading-relaxed font-light"
          >
            Deploy a specialized hive-mind of AI agents to completely orchestrate your large-scale technical events, handle dynamic scheduling conflicts, and execute targeted mass communications.
          </motion.p>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex gap-4"
          >
            <button
              onClick={() => router.push("/login")}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-purple-500 rounded-full hover:bg-purple-400 overflow-hidden shadow-[0_0_40px_rgba(192,132,252,0.3)]"
            >
              <span className="relative flex items-center gap-2">
                Start Organizing <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-purple-100" />
              </span>
            </button>
          </motion.div>
        </motion.div>

        {/* Orbits */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-[800px] h-[800px] border-[1px] border-purple-300/10 rounded-full pointer-events-none border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-[1200px] h-[1200px] border-[1px] border-violet-400/5 rounded-full pointer-events-none"
        />
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-100 to-white mb-4">
            Four Specialized Nodes
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Each node is an autonomous AI agent, orchestrated by LangGraph for seamless collaboration.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel glass-panel-hover rounded-2xl p-6 text-center group"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-purple-300/20 group-hover:ring-purple-300/40 transition-all">
                <f.icon className="w-6 h-6 text-purple-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-light">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-4xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-100 to-white mb-4">
            How It Works
          </h2>
        </div>
        <div className="space-y-6">
          {[
            { step: "01", title: "Sign up & describe your event", desc: "Create your organizer profile and input your event details." },
            { step: "02", title: "AI agents do the heavy lifting", desc: "Our multi-agent swarm generates content, resolves scheduling conflicts, and plans logistics in parallel." },
            { step: "03", title: "Review, approve & save", desc: "Everything is saved to your dashboard. Manage reminders, schedule emails, and chat with the helpdesk bot." },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-2xl p-6 flex items-start gap-6"
            >
              <span className="text-3xl font-black text-purple-400/50 shrink-0">{item.step}</span>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-neutral-400 font-light">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-12">
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-full transition-all shadow-[0_0_30px_rgba(192,132,252,0.3)]"
          >
            <Zap className="w-5 h-5" /> Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-neutral-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          <span>OrgaNexus</span>
        </div>
        <p>Built with AI agents, LangGraph, and Gemini.</p>
      </footer>
    </div>
  );
}
