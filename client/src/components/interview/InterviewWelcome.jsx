import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const checks = [
  ["Role focus", "Frontend Developer"],
  ["Interview mode", "Voice-led practice"],
  ["Session length", "30 minutes"],
  ["Evaluation", "Technical + communication"],
];

const briefing = [
  "Answer naturally. The AI adapts follow-ups based on your response.",
  "You can pause the session anytime without losing progress.",
  "Resume context can be added before the room is prepared.",
];

function InterviewWelcome() {
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid h-full w-full max-w-[1480px] grid-rows-[1fr_auto] gap-5 px-5 pb-5 md:px-8 xl:px-10"
    >
      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <div className="flex min-h-0 flex-col justify-center rounded-[40px] border border-white/70 bg-white/42 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_30px_80px_rgba(18,24,35,0.07)] backdrop-blur-2xl md:p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-950/[0.06] bg-white/72 px-3.5 py-2 text-[0.72rem] font-[820] uppercase text-slate-500">
            <span className="size-1.5 rounded-full bg-[#111722]" />
            Interview room
          </span>

          <h1 className="mt-6 max-w-[850px] text-[clamp(3.25rem,6.1vw,6.8rem)] font-[780] leading-[0.9] tracking-normal text-[#0f1420]">
            Your focused interview workspace.
          </h1>

          <p className="mt-6 max-w-[650px] text-[1rem] font-[560] leading-[1.72] text-slate-500">
            A calm voice-first room for practicing real interview answers, tracking confidence, and getting sharper follow-ups without dashboard noise.
          </p>

          <div className="mt-8 grid max-w-[860px] gap-3 sm:grid-cols-2">
            {checks.map(([label, value]) => (
              <div
                className="rounded-[24px] border border-slate-950/[0.055] bg-white/62 px-4 py-3.5 shadow-[0_14px_34px_rgba(18,24,35,0.045)]"
                key={label}
              >
                <span className="block text-[0.72rem] font-[800] uppercase text-slate-400">{label}</span>
                <strong className="mt-1 block text-[1rem] font-[780] text-[#111722]">{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid min-h-0 gap-5">
          <div className="relative overflow-hidden rounded-[40px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,243,250,0.7)),#fbfbfb] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_30px_80px_rgba(18,24,35,0.075)]">
            <div className="absolute inset-x-8 top-20 h-48 rounded-[34px] bg-[linear-gradient(90deg,rgba(17,23,34,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(17,23,34,0.045)_1px,transparent_1px)] bg-[length:34px_34px]" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="text-[0.72rem] font-[820] uppercase text-slate-400">Readiness</span>
                <strong className="mt-1 block text-[1.8rem] font-[780] leading-none text-[#111722]">84%</strong>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[0.78rem] font-[780] text-emerald-800">On track</span>
            </div>

            <div className="relative z-10 mt-9 rounded-[30px] border border-slate-950/[0.06] bg-white/74 p-4">
              <div className="mb-3 flex items-center justify-between text-[0.76rem] font-[780] text-slate-400">
                <span>Frontend Developer path</span>
                <span>5 left</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-950/8">
                <motion.div
                  className="h-full rounded-full bg-[#111722]"
                  initial={{ width: 0 }}
                  animate={{ width: "84%" }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>

            <div className="relative z-10 mt-5 grid gap-3">
              {briefing.map((item) => (
                <div className="flex items-start gap-3 rounded-[22px] px-2 py-1" key={item}>
                  <span className="mt-2 size-1.5 rounded-full bg-[#111722]" />
                  <p className="text-[0.92rem] font-[620] leading-relaxed text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-slate-950/[0.055] bg-[#111722] p-5 text-white shadow-[0_26px_70px_rgba(18,24,35,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-[0.72rem] font-[820] uppercase text-white/45">Next step</span>
                <h2 className="mt-1 text-[1.35rem] font-[780] leading-tight">Check permissions and resume context.</h2>
              </div>
              <motion.button
                onClick={() => navigate("/home/interview/permissions")}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="min-h-12 shrink-0 cursor-pointer rounded-full bg-white px-5 text-[0.9rem] font-[820] text-[#111722] shadow-[0_18px_38px_rgba(0,0,0,0.22)]"
              >
                Start setup
              </motion.button>
            </div>
          </div>
        </aside>
      </div>
    </motion.section>
  );
}

export default InterviewWelcome;
