import React from "react";
import { useUser } from "@clerk/clerk-react";
import { motion } from "framer-motion";

const pageShell = "font-[Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#151923] [&_*]:box-border [&_*]:font-[inherit]";
const maxWidth = "mx-auto w-full max-w-[1480px] px-5 md:px-8 xl:px-10";
const kicker = "inline-flex items-center gap-2.5 text-[0.74rem] font-[780] uppercase text-slate-500 before:block before:size-2 before:rounded-full before:bg-slate-950/20";
const softCard = "rounded-[34px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_60px_rgba(18,24,35,0.06)]";
const fieldClass = "min-h-[50px] w-full rounded-[18px] border border-slate-950/[0.07] bg-white/70 px-4 text-[0.95rem] font-[620] text-[#151923] outline-none transition focus:border-slate-950/20 focus:bg-white";
const labelClass = "mb-2 block text-[0.78rem] font-[760] uppercase text-slate-400";
const buttonBase = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 text-[0.88rem] font-[760] transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-slate-950/15";
const primaryButton = `${buttonBase} border border-[#121722] bg-[#121722] text-white shadow-[0_18px_36px_rgba(18,23,34,0.18)]`;
const secondaryButton = `${buttonBase} border border-slate-950/[0.08] bg-white/70 text-slate-900 shadow-[0_12px_26px_rgba(18,24,35,0.045)]`;

const connectedAccounts = ["GitHub", "LinkedIn", "LeetCode", "HackerRank", "Codeforces", "Kaggle"];

const slideDirections = {
  left: { x: -44, y: 10 },
  right: { x: 44, y: 10 },
  up: { x: 0, y: 34 },
};

const getReveal = (direction = "up") => ({
  hidden: { opacity: 0, ...slideDirections[direction] },
  visible: { opacity: 1, x: 0, y: 0 },
});

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

const motionCardProps = {
  variants: getReveal("up"),
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, amount: 0.18 },
  transition: revealTransition,
  whileHover: { y: -4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 30px 70px rgba(18,24,35,0.085)" },
};

const motionCard = (direction) => ({
  ...motionCardProps,
  variants: getReveal(direction),
});

const Field = ({ label, placeholder, defaultValue, type = "text" }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input className={fieldClass} defaultValue={defaultValue} placeholder={placeholder} type={type} />
  </label>
);

const SelectField = ({ label, defaultValue, options }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <select className={fieldClass} defaultValue={defaultValue}>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  </label>
);

const Profile = () => {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const fullName = user?.fullName || "";

  return (
    <main className={`${pageShell} min-h-screen overflow-hidden bg-[linear-gradient(90deg,rgba(24,30,42,0.028)_1px,transparent_1px),linear-gradient(180deg,rgba(24,30,42,0.026)_1px,transparent_1px),linear-gradient(180deg,#fbfbfa_0%,#f3f3f0_55%,#ededeb_100%)] bg-[length:84px_84px,84px_84px,auto] pb-20 pt-28 md:pt-32`}>
      <section className={maxWidth}>
        <header className="grid gap-8 pb-12 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <span className={kicker}>Profile Setup</span>
            <h1 className="mt-5 max-w-[860px] text-[clamp(3.2rem,5.8vw,6.5rem)] leading-[0.94] font-[780] tracking-normal text-[#101522]">
              Candidate Detail Sheet
            </h1>
            <p className="mt-6 max-w-[680px] text-[1.02rem] leading-[1.75] font-[560] text-slate-500">
              Keep your interview profile ready. These details can later help personalize interviews without crowding the session setup.
            </p>
          </div>

          <motion.aside
            className={`${softCard} p-6`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...revealTransition, delay: 0.08 }}
            whileHover={{ y: -3 }}
          >
            <div className="flex items-center justify-between gap-5">
              <div>
                <strong className="block text-[1.15rem] font-[780] text-[#151923]">Profile completion</strong>
                <span className="mt-1 block text-[0.9rem] font-[560] text-slate-500">Core details started</span>
              </div>
              <span className="text-[2rem] font-[780] text-[#151923]">32%</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950/10">
              <span className="block h-full w-[32%] rounded-full bg-[#151923]" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className={primaryButton} type="button">Save</button>
              <button className={secondaryButton} type="button">Reset</button>
            </div>
          </motion.aside>
        </header>

        <div className="grid gap-7">
          <div className="grid gap-7 xl:grid-cols-2">
            <motion.section {...motionCard("left")} className={`${softCard} p-6 md:p-8`} aria-labelledby="identity-heading">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Identity</span>
                  <h2 id="identity-heading" className="mt-3 text-[2rem] leading-none font-[780] text-[#111722]">Personal details</h2>
                </div>
                <span className="text-[0.74rem] font-[800] text-slate-400">01</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Full name" defaultValue={fullName} placeholder="Ayush Kumar" />
                <Field label="Preferred name" placeholder="Ayush" />
                <Field label="Email" defaultValue={email} placeholder="you@example.com" type="email" />
                <Field label="Phone" placeholder="+91 98765 43210" type="tel" />
                <Field label="Location" placeholder="Bengaluru, India" />
                <SelectField label="Time zone" defaultValue="Asia/Kolkata" options={["Asia/Kolkata", "UTC", "America/New_York", "Europe/London"]} />
              </div>
            </motion.section>

            <motion.section {...motionCard("right")} className={`${softCard} p-6 md:p-8`} aria-labelledby="career-heading">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Career Target</span>
                  <h2 id="career-heading" className="mt-3 text-[2rem] leading-none font-[780] text-[#111722]">What you are preparing for</h2>
                </div>
                <span className="text-[0.74rem] font-[800] text-slate-400">02</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Target role" placeholder="Frontend Developer" />
                <SelectField label="Seniority level" defaultValue="Entry level" options={["Internship", "Entry level", "Junior", "Mid level", "Senior"]} />
                <Field label="Preferred tech stack" placeholder="React, JavaScript, TypeScript" />
                <SelectField label="Job type" defaultValue="Internship" options={["Internship", "Full-time", "Contract", "Freelance"]} />
                <SelectField label="Work mode" defaultValue="Remote" options={["Remote", "Hybrid", "Onsite"]} />
                <Field label="Target companies / industries" placeholder="SaaS, fintech, AI startups" />
              </div>
            </motion.section>
          </div>

          <motion.section {...motionCard("up")} className={`${softCard} p-6 md:p-8`} aria-labelledby="accounts-heading">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Connected Accounts</span>
                  <h2 id="accounts-heading" className="mt-3 text-[2rem] leading-none font-[780] text-[#111722]">Link your platforms</h2>
                </div>
                <span className="text-[0.74rem] font-[800] text-slate-400">03</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {connectedAccounts.map((account) => (
                  <motion.button
                    className="group flex min-h-[86px] items-center justify-between rounded-[24px] border border-slate-950/[0.055] bg-white/60 px-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition duration-200 hover:-translate-y-0.5 hover:bg-white"
                    key={account}
                    type="button"
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <span>
                      <strong className="block text-[1rem] font-[780] text-[#151923]">{account}</strong>
                      <span className="mt-1 block text-[0.82rem] font-[560] text-slate-500">Not connected</span>
                    </span>
                    <span className="rounded-full bg-slate-950/[0.06] px-3 py-1.5 text-[0.76rem] font-[760] text-slate-600 group-hover:bg-[#151923] group-hover:text-white">
                      Connect
                    </span>
                  </motion.button>
                ))}
              </div>
          </motion.section>

          <div className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
            <motion.section {...motionCard("left")} className={`${softCard} p-6 md:p-8`} aria-labelledby="resume-heading">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Resume</span>
                  <h2 id="resume-heading" className="mt-3 text-[2rem] leading-none font-[780] text-[#111722]">Upload source of truth</h2>
                </div>
                <span className="text-[0.74rem] font-[800] text-slate-400">04</span>
              </div>
              <div className="rounded-[30px] border border-dashed border-slate-950/15 bg-white/55 p-8">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div>
                    <strong className="block text-[1.25rem] font-[780] text-[#151923]">Upload resume</strong>
                    <p className="mt-2 max-w-[520px] text-[0.95rem] leading-relaxed font-[560] text-slate-500">
                      PDF or DOCX. Experience, education, and projects can be extracted from this later.
                    </p>
                  </div>
                  <label className={secondaryButton}>
                    Choose file
                    <input className="hidden" type="file" accept=".pdf,.doc,.docx" />
                  </label>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-[0.86rem] font-[620] text-slate-500">
                  <span className="rounded-full bg-slate-950/[0.06] px-3 py-2">No resume uploaded</span>
                  <button className="rounded-full px-3 py-2 text-slate-600 hover:bg-slate-950/[0.06]" type="button">Replace</button>
                  <button className="rounded-full px-3 py-2 text-slate-600 hover:bg-slate-950/[0.06]" type="button">Remove</button>
                </div>
              </div>
            </motion.section>

            <motion.section {...motionCard("right")} className={`${softCard} p-6 md:p-8`} aria-labelledby="preferences-heading">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Interview Preferences</span>
                  <h2 id="preferences-heading" className="mt-3 text-[2rem] leading-none font-[780] text-[#111722]">How sessions should feel</h2>
                </div>
                <span className="text-[0.74rem] font-[800] text-slate-400">05</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <SelectField label="Interview language" defaultValue="English" options={["English", "Hindi", "Hinglish"]} />
                <SelectField label="Difficulty preference" defaultValue="Adaptive" options={["Beginner", "Intermediate", "Advanced", "Adaptive"]} />
                <SelectField label="Interview focus" defaultValue="Technical + project deep dive" options={["Technical", "Behavioral", "System design", "Project deep dive", "Technical + project deep dive"]} />
                <SelectField label="Voice pace" defaultValue="Balanced" options={["Slow", "Balanced", "Fast"]} />
                <div className="md:col-span-2">
                  <SelectField label="Feedback style" defaultValue="Detailed and direct" options={["Encouraging", "Detailed and direct", "Concise", "Score-focused"]} />
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Profile;
