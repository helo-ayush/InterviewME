import React from "react";
import { motion } from "framer-motion";

function AeroOrb({ size = "lg" }) {
  const sizeClass = size === "xs" ? "h-8 w-8" : size === "sm" ? "h-12 w-12" : "h-16 w-16";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        {/* Glow Background Outer Ring */}
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`${sizeClass} absolute rounded-full bg-[#6b9080] blur-xl`}
        />

        {/* Morphing Liquid Core */}
        <motion.div
          animate={{
            borderRadius: [
              "50% 50% 50% 50%",
              "42% 58% 45% 55%",
              "55% 45% 58% 42%",
              "48% 52% 48% 52%",
              "50% 50% 50% 50%",
            ],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
          className={`${sizeClass} relative overflow-hidden bg-gradient-to-tr from-[#6b9080] via-[#8faea0] to-[#ccd5ae] shadow-[0_12px_36px_rgba(107,144,128,0.35)] ring-1 ring-white/50`}
        >
          {/* Inner Light Highlights */}
          <div className="absolute left-2 top-2 h-1/2 w-1/2 rounded-full bg-white/40 blur-[2px]" />
          <div className="absolute bottom-1.5 right-1.5 h-1/3 w-1/3 rounded-full bg-teal-200/30 blur-[1px]" />
        </motion.div>
      </div>
    </div>
  );
}

export default AeroOrb;
