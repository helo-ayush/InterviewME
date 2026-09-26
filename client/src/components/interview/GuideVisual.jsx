import React from "react";
import { motion } from "framer-motion";

function GuideVisual({ bubble = "Might need some permissions to proceed?" }) {
  return (
    <div className="relative flex h-[500px] items-center justify-center overflow-hidden rounded-[3rem] border border-neutral-200 bg-[#f0f3f1] p-6 shadow-[0_20px_60px_rgba(107,144,128,0.1)]">
      <div className="absolute inset-x-8 bottom-8 h-16 rounded-full bg-[#6b9080]/20 blur-2xl" />
      <motion.div
        className="relative"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute -right-36 top-6 max-w-[160px] rounded-3xl bg-white px-4 py-3 text-xs font-black leading-5 text-neutral-600 shadow-[0_16px_35px_rgba(107,144,128,0.14)]">
          {bubble}
        </div>
        <div className="relative mx-auto h-44 w-40">
          <div className="absolute left-1/2 top-0 h-16 w-3 -translate-x-1/2 rounded-full bg-teal-500/70" />
          <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-teal-400 shadow-md" />
          <div className="absolute left-1/2 top-12 h-28 w-36 -translate-x-1/2 rounded-[2rem] bg-[#75b8b4] shadow-[inset_-12px_-16px_24px_rgba(40,80,78,0.22),0_20px_35px_rgba(87,106,151,0.25)]">
            <div className="absolute left-1/2 top-6 h-16 w-28 -translate-x-1/2 rounded-3xl bg-[#173139]">
              <div className="absolute left-6 top-5 h-4 w-5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(165,243,252,0.8)]" />
              <div className="absolute right-6 top-5 h-4 w-5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(165,243,252,0.8)]" />
              <div className="absolute bottom-4 left-1/2 h-3 w-10 -translate-x-1/2 rounded-b-full bg-cyan-200" />
            </div>
          </div>
          <div className="absolute bottom-0 left-5 h-20 w-16 rotate-12 rounded-[2rem] bg-[#83c5c0] shadow-lg" />
          <div className="absolute bottom-2 right-0 h-14 w-20 -rotate-12 rounded-[2rem] bg-[#6fb5b1] shadow-lg" />
        </div>
      </motion.div>
    </div>
  );
}

export default GuideVisual;
