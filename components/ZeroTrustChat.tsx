"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Trash2,
  Send,
  AlertTriangle,
  Lock,
  Cpu,
  Flame,
  EyeOff,
  Radio,
  CornerDownLeft,
} from "lucide-react";

export type MessageStatus = "ok" | "dlp_redacted" | "blocked_403" | "ratelimit_429";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sanitizedPrompt?: string;
  status?: MessageStatus;
  timestamp: string;
  latencyMs?: number;
  httpCode?: number;
}

const SCANNING_STEPS = [
  "> [SYSTEM] Intercepting payload...",
  "> [DLP] Scrubbing PII regex...",
  "> [LlamaGuard] Verifying semantic intent...",
];

const STATIC_DEFENSES = [
  {
    id: "dlp",
    name: "Pattern DLP",
    detail: "PII & Secret Regex Scrubber",
  },
  {
    id: "mdos",
    name: "mDoS Rate Limiter",
    detail: "Adaptive Token Bucket Guard",
  },
  {
    id: "llamaguard",
    name: "Llama Guard 3",
    detail: "Semantic Prompt Firewall",
  },
];

// ---------------------------------------------------------------------------
// Animated Telemetry Counter (Ticks up from 0 to target value on load)
// ---------------------------------------------------------------------------
function AnimatedCounter({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
    const controls = animate(count, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [value, count, rounded]);

  return <span>{displayValue}</span>;
}

// ---------------------------------------------------------------------------
// Main Zero-Trust LLM Gateway Single-View Dashboard Component
// ---------------------------------------------------------------------------
export default function ZeroTrustChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      role: "assistant",
      content:
        "Zero-Trust LLM Gateway online (`http://localhost:8000/chat`). Outbound prompts are intercepted for Pattern DLP regex scrubbing, mDoS rate limiting, and Llama Guard 3 semantic intent verification. Press Ctrl + Enter (or Cmd + Enter) to transmit.",
      status: "ok",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      latencyMs: 34,
      httpCode: 200,
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);

  // Yellow DLP Alert Banner State
  const [dlpAlertVisible, setDlpAlertVisible] = useState(false);
  const [lastRedactedDiff, setLastRedactedDiff] = useState<{
    original: string;
    sanitized: string;
  } | null>(null);

  // Four Prominent Metric Cards (Tick up from 0 on load)
  const [telemetry, setTelemetry] = useState({
    inspected: 1284,
    dlpRedacted: 42,
    blocked403: 19,
    throttled429: 8,
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, scanStepIndex]);

  const handleClearHistory = () => {
    if (isLoading) return;
    setMessages([
      {
        id: `clear-${Date.now()}`,
        role: "assistant",
        content:
          "Audit log cleared. Zero-Trust LLM Gateway session state reset.",
        status: "ok",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        httpCode: 200,
      },
    ]);
    setDlpAlertVisible(false);
    setLastRedactedDiff(null);
  };

  const runScanningSequence = async () => {
    for (let i = 0; i < SCANNING_STEPS.length; i++) {
      setScanStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
  };

  const submitPrompt = async () => {
    const trimmedPrompt = input.trim();
    if (!trimmedPrompt || isLoading) return;

    const nowStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedPrompt,
      timestamp: nowStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setScanStepIndex(0);

    const startTime = performance.now();

    try {
      const [response] = await Promise.all([
        fetch("http://localhost:8000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmedPrompt }),
        }),
        runScanningSequence(),
      ]);

      const latencyMs = Math.round(performance.now() - startTime);
      const replyTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (response.status === 200) {
        const data = await response.json();
        const isRedacted =
          typeof data.sanitized_prompt === "string" &&
          data.sanitized_prompt !== trimmedPrompt;

        if (isRedacted) {
          setDlpAlertVisible(true);
          setLastRedactedDiff({
            original: trimmedPrompt,
            sanitized: data.sanitized_prompt,
          });
        }

        setTelemetry((prev) => ({
          ...prev,
          inspected: prev.inspected + 1,
          dlpRedacted: isRedacted ? prev.dlpRedacted + 1 : prev.dlpRedacted,
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content:
              data.reply ?? "Verified response received from Zero-Trust LLM Gateway.",
            sanitizedPrompt: isRedacted ? data.sanitized_prompt : undefined,
            status: isRedacted ? "dlp_redacted" : "ok",
            timestamp: replyTime,
            latencyMs,
            httpCode: 200,
          },
        ]);
      } else if (response.status === 403) {
        let errorDetail = "";
        try {
          const errJson = await response.json();
          errorDetail = errJson?.detail || errJson?.error || "";
        } catch {
          // ignore non-JSON body
        }

        setTelemetry((prev) => ({
          ...prev,
          inspected: prev.inspected + 1,
          blocked403: prev.blocked403 + 1,
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `err-403-${Date.now()}`,
            role: "system",
            content: `[HTTP 403 FORBIDDEN] Threat Blocked: Payload was rejected by the semantic firewall (Llama Guard 3).${
              errorDetail ? ` Detail: ${errorDetail}` : ""
            }`,
            status: "blocked_403",
            timestamp: replyTime,
            latencyMs,
            httpCode: 403,
          },
        ]);
      } else if (response.status === 429) {
        setTelemetry((prev) => ({
          ...prev,
          inspected: prev.inspected + 1,
          throttled429: prev.throttled429 + 1,
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `err-429-${Date.now()}`,
            role: "system",
            content:
              "[HTTP 429 TOO MANY REQUESTS] Rate Limited: mDoS protection kicked in. Outbound token bucket exhausted—requests are temporarily throttled.",
            status: "ratelimit_429",
            timestamp: replyTime,
            latencyMs,
            httpCode: 429,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-status-${Date.now()}`,
            role: "system",
            content: `[HTTP ${response.status}] Unexpected gateway response from http://localhost:8000/chat.`,
            status: "blocked_403",
            timestamp: replyTime,
            latencyMs,
            httpCode: response.status,
          },
        ]);
      }
    } catch {
      const latencyMs = Math.round(performance.now() - startTime);
      setTelemetry((prev) => ({
        ...prev,
        inspected: prev.inspected + 1,
      }));
      setMessages((prev) => [
        ...prev,
        {
          id: `net-err-${Date.now()}`,
          role: "system",
          content:
            "Gateway connection error: Unable to reach http://localhost:8000/chat. Ensure the FastAPI Zero-Trust LLM Gateway backend is listening on port 8000.",
          status: "blocked_403",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          latencyMs,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submitPrompt();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPrompt();
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.14, delayChildren: 0.05 },
        },
      }}
      className="flex h-screen w-full overflow-hidden bg-[#05080f] text-slate-100 select-none"
    >
      {/* 1. CLEAN LEFT SIDEBAR — Staggered Slide-Up on Page Load */}
      <motion.aside
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        className="w-80 shrink-0 border-r border-emerald-500/20 bg-slate-950/85 backdrop-blur-xl flex flex-col justify-between p-5"
      >
        <div className="space-y-6">
          {/* Project Name Header: Strictly "Zero-Trust LLM Gateway" */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 shadow-[0_0_18px_rgba(16,185,129,0.22)]">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold tracking-wide text-white">
                Zero-Trust LLM Gateway
              </h1>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                SOC Inspection Pipeline
              </p>
            </div>
          </div>

          {/* Glowing "System Status: Online" Indicator */}
          <div className="rounded-xl p-3.5 bg-emerald-950/25 border border-emerald-500/35 shadow-[0_0_24px_rgba(16,185,129,0.14)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 shadow-[0_0_10px_#10b981]" />
                </span>
                <span className="font-mono text-xs font-semibold tracking-wide text-emerald-300">
                  System Status: Online
                </span>
              </div>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-emerald-500/15 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>ENDPOINT</span>
              <span className="text-cyan-400">localhost:8000/chat</span>
            </div>
          </div>

          {/* Static Active Defenses with Glowing Green Status Dots (No Dummy Toggles) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                Active Defenses
              </span>
              <span className="text-[10px] font-mono text-emerald-400">STATIC</span>
            </div>

            <div className="rounded-xl bg-slate-900/60 border border-slate-800/90 divide-y divide-slate-800/70 backdrop-blur-md">
              {STATIC_DEFENSES.map((defense) => (
                <div key={defense.id} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-100">{defense.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{defense.detail}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400/90 uppercase">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Four Telemetry Metric Cards ("INSPECTED", "DLP REDACTED", "403 BLOCKED", "429 THROTTLED") */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
              Gateway Telemetry
            </span>
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] text-slate-400 tracking-wider">INSPECTED</div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  <AnimatedCounter value={telemetry.inspected} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/25">
                <div className="text-[10px] text-amber-300/80 tracking-wider">
                  DLP REDACTED
                </div>
                <div className="text-lg font-bold text-amber-300 mt-1">
                  <AnimatedCounter value={telemetry.dlpRedacted} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/25">
                <div className="text-[10px] text-red-300/80 tracking-wider">
                  403 BLOCKED
                </div>
                <div className="text-lg font-bold text-red-400 mt-1">
                  <AnimatedCounter value={telemetry.blocked403} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/25">
                <div className="text-[10px] text-cyan-300/80 tracking-wider">
                  429 THROTTLED
                </div>
                <div className="text-lg font-bold text-cyan-300 mt-1">
                  <AnimatedCounter value={telemetry.throttled429} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Chat History Action */}
        <div className="pt-4 border-t border-slate-800/80">
          <motion.button
            type="button"
            disabled={isLoading}
            onClick={handleClearHistory}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 22px rgba(6, 182, 212, 0.28)",
            }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs font-semibold text-cyan-300 bg-slate-900/80 hover:bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat History
          </motion.button>
        </div>
      </motion.aside>

      {/* 2. MAIN CHAT AREA — Staggered Slide-Up on Page Load */}
      <motion.main
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        className="flex-1 flex flex-col relative h-full overflow-hidden"
      >
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-emerald-500/15 bg-slate-950/65 backdrop-blur-xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-mono font-semibold text-slate-100">
                Zero-Trust LLM Gateway
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Pipeline: Prompt Ingress → Pattern DLP → mDoS Rate Limiter → Llama Guard 3
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              POST http://localhost:8000/chat
            </span>
          </div>
        </header>

        {/* Yellow UI Alert Banner when DLP Redacts PII */}
        <AnimatePresence>
          {dlpAlertVisible && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mx-6 mt-4 rounded-xl bg-amber-500/10 border border-amber-400/50 backdrop-blur-xl p-3.5 shadow-[0_0_24px_rgba(245,158,11,0.2)] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-400/20 text-amber-300">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                      DLP Active: PII redacted
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200">
                      SANITIZED BEFORE INFERENCE
                    </span>
                  </div>
                  {lastRedactedDiff && (
                    <p className="text-xs font-mono text-amber-100/90 mt-0.5">
                      Forwarded payload:{" "}
                      <span className="text-amber-300 underline decoration-dotted">
                        {lastRedactedDiff.sanitized}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDlpAlertVisible(false)}
                className="text-xs font-mono text-amber-300 hover:text-amber-100 px-2.5 py-1 rounded-lg border border-amber-400/30 hover:bg-amber-400/10"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat History with AnimatePresence & Spring Physics (stiffness: 200, damping: 20) */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-40 space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const isBlocked403 = msg.status === "blocked_403";
              const isRateLimit429 = msg.status === "ratelimit_429";
              const isDlpRedacted = msg.status === "dlp_redacted";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 24, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 backdrop-blur-xl border transition-all ${
                      isUser
                        ? "bg-cyan-950/35 border-cyan-500/35 text-slate-100 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
                        : isBlocked403
                        ? "bg-red-950/40 border-red-500/60 text-red-100 shadow-[0_0_28px_rgba(239,68,68,0.32)]"
                        : isRateLimit429
                        ? "bg-amber-950/40 border-amber-500/60 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.28)]"
                        : "bg-slate-900/75 border-emerald-500/25 text-slate-100 shadow-[0_0_18px_rgba(16,185,129,0.08)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        {isUser ? (
                          <span className="text-cyan-300 font-semibold">OPERATOR // PROMPT</span>
                        ) : isBlocked403 ? (
                          <span className="text-red-400 font-bold flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-red-400" />
                            ZERO-TRUST LLM GATEWAY // 403 THREAT BLOCKED
                          </span>
                        ) : isRateLimit429 ? (
                          <span className="text-amber-300 font-bold flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-amber-400" />
                            ZERO-TRUST LLM GATEWAY // 429 RATE LIMITED
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            ZERO-TRUST LLM GATEWAY // 200 VERIFIED
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400">
                        {msg.timestamp}
                        {msg.latencyMs ? ` • ${msg.latencyMs}ms` : ""}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                      {msg.content}
                    </p>

                    {isDlpRedacted && msg.sanitizedPrompt && (
                      <div className="mt-3 pt-2.5 border-t border-amber-500/25 flex items-center gap-2 text-xs font-mono text-amber-300">
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        <span>Sanitized Prompt: {msg.sanitizedPrompt}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* 4. Premium Scanning Sequence (Loading State) */}
            {isLoading && (
              <motion.div
                key="scanning-loader"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="flex justify-start"
              >
                <div className="relative overflow-hidden rounded-2xl p-4 bg-slate-950/90 border border-emerald-500/45 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] max-w-lg w-full">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-4 h-4 text-emerald-400 animate-spin" />
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={scanStepIndex}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className="font-mono text-xs text-emerald-300 font-semibold tracking-wide"
                        >
                          {SCANNING_STEPS[scanStepIndex]}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 animate-pulse">
                      STAGE {scanStepIndex + 1}/3
                    </span>
                  </div>

                  {/* Glowing Neon-Green Scanning Line Beneath Text */}
                  <div className="relative h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.15,
                        ease: "linear",
                      }}
                      className="w-1/2 h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#10b981]"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chatEndRef} />
        </div>

        {/* Sleek Floating Chat Input Fixed at Bottom (Ctrl+Enter + Instant Lockout & Dimming) */}
        <div className="absolute bottom-5 left-6 right-6 z-20">
          <form
            onSubmit={handleFormSubmit}
            className={`max-w-4xl mx-auto rounded-2xl bg-slate-900/85 backdrop-blur-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(5,8,15,0.9)] p-2.5 flex items-center gap-2.5 transition-opacity duration-200 ${
              isLoading ? "opacity-40 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="pl-2.5 pr-1 text-emerald-400 font-mono text-sm font-bold select-none">
              &gt;_
            </div>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Scanning payload in progress — input locked..."
                  : "Enter prompt for Zero-Trust LLM Gateway (Press Ctrl + Enter to send)..."
              }
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-mono disabled:cursor-not-allowed"
            />
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-400">
              <span>Ctrl + Enter</span>
              <CornerDownLeft className="w-3 h-3 text-emerald-400" />
            </div>
            <motion.button
              type="submit"
              disabled={isLoading || !input.trim()}
              whileHover={{
                scale: 1.04,
                boxShadow: "0 0 22px rgba(16, 185, 129, 0.45)",
              }}
              whileTap={{ scale: 0.96 }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </motion.button>
          </form>
        </div>
      </motion.main>
    </motion.div>
  );
}
