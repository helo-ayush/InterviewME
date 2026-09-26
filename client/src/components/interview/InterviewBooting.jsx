import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useOutletContext } from "react-router-dom";
import AeroOrb from "./AeroOrb";

const bootSteps = [
  {
    title: "Reading profile context",
    detail: "Checking resume, target path, and available interview signals.",
  },
  {
    title: "Designing the opening round",
    detail: "Choosing prompts that fit your current preparation level.",
  },
  {
    title: "Calibrating voice room",
    detail: "Preparing audio, transcript, and answer timing.",
  },
  {
    title: "Final readiness check",
    detail: "Making the room available for your live session.",
  },
];

function InterviewBooting() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const progress = ((activeStep + 1) / bootSteps.length) * 100;
  const { token, roomName, initError } = useOutletContext();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((currentStep) => Math.min(currentStep + 1, bootSteps.length - 1));
    }, 1150);

    return () => window.clearInterval(timer);
  }, []);

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
          Session setup
        </span>
        <h1 className="mt-6 max-w-[900px] text-[clamp(3rem,5.7vw,6.3rem)] font-[780] leading-[0.92] tracking-normal text-[#0f1420]">
          Building your interview room.
        </h1>
        <p className="mt-5 max-w-[620px] text-[0.98rem] font-[560] leading-[1.72] text-slate-500">
          The room is being prepared in the background. Once the connection is ready, you can enter the live interview workspace.
        </p>

        <div className="mt-8 max-w-[760px]">
          <div className="mb-3 flex items-center justify-between text-[0.76rem] font-[820] uppercase text-slate-400">
            <span>Preparation progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-950/8">
            <motion.div
              className="h-full rounded-full bg-[#111722]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
          {initError ? (
            <p className="mt-3 text-[0.88rem] font-[700] text-rose-500">Error: {initError}</p>
          ) : !token ? (
            <p className="mt-3 text-[0.88rem] font-[650] text-slate-400">Connecting to session server...</p>
          ) : (
            <p className="mt-3 text-[0.88rem] font-[700] text-emerald-700">Room ready{roomName ? `: ${roomName}` : ""}</p>
          )}
        </div>

        <div className="mt-8 grid max-w-[880px] gap-3 md:grid-cols-2">
          {bootSteps.map((step, index) => {
            const complete = index < activeStep;
            const active = index === activeStep;

            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className={`rounded-[28px] border p-4 transition ${
                  active
                    ? "border-slate-950/[0.08] bg-white shadow-[0_18px_44px_rgba(18,24,35,0.065)]"
                    : "border-slate-950/[0.045] bg-white/54"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-[0.98rem] font-[780] text-[#111722]">{step.title}</strong>
                  <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-[820] ${complete ? "bg-emerald-50 text-emerald-800" : active ? "bg-[#111722] text-white" : "bg-slate-950/[0.06] text-slate-400"}`}>
                    {complete ? "Done" : active ? "Working" : "Next"}
                  </span>
                </div>
                <p className="mt-2 text-[0.86rem] font-[560] leading-relaxed text-slate-500">{step.detail}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col justify-between rounded-[40px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,243,250,0.7)),#fbfbfb] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_30px_80px_rgba(18,24,35,0.075)] xl:flex">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[0.72rem] font-[820] uppercase text-slate-400">Live status</span>
            <strong className="mt-1 block text-[1.25rem] font-[780] text-[#111722]">{bootSteps[activeStep].title}</strong>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[0.78rem] font-[780] text-slate-500 shadow-[0_12px_28px_rgba(18,24,35,0.06)]">
            {activeStep + 1}/{bootSteps.length}
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute size-[330px] rounded-full bg-slate-950/[0.035] blur-3xl" />
          <div className="relative grid size-[230px] place-items-center rounded-[44px] border border-slate-950/[0.055] bg-white/64 shadow-inner">
            <AeroOrb size="lg" />
          </div>
        </div>

        <motion.button
          onClick={() => navigate("/home/interview/session")}
          whileHover={!token ? {} : { y: -2 }}
          whileTap={!token ? {} : { scale: 0.98 }}
          disabled={!token}
          className={`min-h-12 rounded-full px-6 text-[0.92rem] font-[820] shadow-[0_18px_38px_rgba(18,24,35,0.18)] transition ${
            !token
              ? "cursor-not-allowed bg-slate-300 text-white shadow-none"
              : "cursor-pointer bg-[#111722] text-white hover:bg-[#20283a]"
          }`}
          type="button"
        >
          Enter interview
        </motion.button>
      </aside>
    </motion.section>
  );
}

export default InterviewBooting;
