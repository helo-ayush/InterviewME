import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const summary = [
  ["Readiness", "84"],
  ["Technical", "87"],
  ["Communication", "78"],
];

function InterviewComplete() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid h-full w-full max-w-[1480px] gap-5 px-5 pb-5 md:px-8 xl:grid-cols-[minmax(0,1fr)_440px] xl:px-10"
    >
      <div className="flex min-h-0 flex-col justify-center rounded-[40px] border border-white/70 bg-white/42 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_30px_80px_rgba(18,24,35,0.07)] backdrop-blur-2xl md:p-10">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-950/[0.06] bg-white/72 px-3.5 py-2 text-[0.72rem] font-[820] uppercase text-slate-500">
          <span className="size-1.5 rounded-full bg-[#111722]" />
          Session complete
        </span>
        <h1 className="mt-6 max-w-[860px] text-[clamp(3rem,5.8vw,6.25rem)] font-[780] leading-[0.92] tracking-normal text-[#0f1420]">
          Interview finished with useful signal.
        </h1>
        <p className="mt-5 max-w-[650px] text-[0.98rem] font-[560] leading-[1.72] text-slate-500">
          This feedback UI is ready for future scoring logic. For now, it gives the session a polished ending and a place to capture user reaction.
        </p>

        <div className="mt-8 grid max-w-[760px] gap-3 sm:grid-cols-3">
          {summary.map(([label, score]) => (
            <div className="rounded-[26px] border border-slate-950/[0.055] bg-white/62 p-4 shadow-[0_14px_34px_rgba(18,24,35,0.045)]" key={label}>
              <span className="block text-[0.72rem] font-[820] uppercase text-slate-400">{label}</span>
              <strong className="mt-2 block text-[2rem] font-[780] leading-none text-[#111722]">{score}</strong>
            </div>
          ))}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col justify-between rounded-[40px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,243,250,0.7)),#fbfbfb] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_30px_80px_rgba(18,24,35,0.075)]">
        <div>
          <span className="text-[0.72rem] font-[820] uppercase text-slate-400">Your rating</span>
          <h2 className="mt-2 text-[1.75rem] font-[780] leading-tight text-[#111722]">How did this session feel?</h2>
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`cursor-pointer text-[2rem] leading-none transition hover:-translate-y-0.5 ${star <= rating ? "text-[#111722]" : "text-slate-300"}`}
                type="button"
              >
                {"\u2605"}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-[0.9rem] font-[760] text-[#111722]">Session notes</span>
          <textarea
            className="mt-3 h-36 w-full resize-none rounded-[26px] border border-slate-950/[0.07] bg-white/70 p-4 text-[0.9rem] font-[560] leading-relaxed text-slate-600 outline-none transition focus:border-slate-950/20 focus:bg-white"
            placeholder="Share anything you want to improve next time."
          />
        </label>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/home")}
            className="min-h-12 cursor-pointer rounded-full px-5 text-[0.9rem] font-[780] text-slate-500 transition hover:bg-slate-950/[0.05] hover:text-[#111722]"
            type="button"
          >
            Home
          </button>
          <motion.button
            onClick={() => navigate("/home/interview")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="min-h-12 cursor-pointer rounded-full bg-[#111722] px-6 text-[0.9rem] font-[820] text-white shadow-[0_18px_38px_rgba(18,24,35,0.18)]"
            type="button"
          >
            New interview
          </motion.button>
        </div>
      </aside>
    </motion.section>
  );
}

export default InterviewComplete;
