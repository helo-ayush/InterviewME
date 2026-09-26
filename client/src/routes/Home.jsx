import React from 'react';
import { motion } from 'framer-motion';

const paths = [
  { name: 'React Developer', progress: 66, remaining: '5 interviews remaining', badge: 'Active', meta: 'FRONTEND PATH', marker: '05 left', featured: true },
  { name: 'Frontend Fundamentals', progress: 100, remaining: 'Completed', badge: 'Completed', meta: 'CORE SKILLS', marker: 'Done', complete: true },
  { name: 'JavaScript Mastery', progress: 40, remaining: '3 interviews remaining', badge: 'In progress', meta: 'LANGUAGE DEPTH', marker: '03 left' },
  { name: 'System Design', progress: 12, remaining: '8 interviews remaining', badge: 'New focus', meta: 'ARCHITECTURE', marker: '08 left' },
];

const recentInterviews = [
  { title: 'React Project Interview', score: '88%', date: 'Yesterday', type: 'Technical' },
  { title: 'Behavioral Round', score: '79%', date: '2 Days Ago', type: 'Communication' },
  { title: 'JavaScript Deep Dive', score: '91%', date: '4 Days Ago', type: 'Technical' },
];

const scores = [
  { label: 'Interview readiness', value: 84 },
  { label: 'Communication', value: 78 },
  { label: 'Technical', value: 87 },
  { label: 'Confidence', value: 81 },
];

const pageShell = "font-[Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#151923] [&_*]:box-border [&_*]:font-[inherit]";
const maxWidth = 'mx-auto w-full max-w-[1480px] px-5 md:px-8 xl:px-10';
const kicker = 'inline-flex items-center gap-2.5 text-[0.74rem] font-[780] uppercase text-slate-500 before:block before:size-2 before:rounded-full before:bg-slate-950/20';
const button = 'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full px-5 text-[0.9rem] font-[760] transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-slate-950/15';
const primaryButton = `${button} border border-[#121722] bg-[#121722] text-white shadow-[0_18px_36px_rgba(18,23,34,0.18)]`;
const secondaryButton = `${button} border border-slate-950/[0.08] bg-white/70 text-slate-900 shadow-[0_12px_26px_rgba(18,24,35,0.045)]`;
const glassCard = 'border border-slate-950/[0.06] bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_60px_rgba(20,25,35,0.075)] backdrop-blur-[18px]';

const progressBackground = (value) => ({
  background: `radial-gradient(circle, #fbfbfa 0 55%, transparent 56%), conic-gradient(#111725 0 ${value * 3.6}deg, #e4e5e6 ${value * 3.6}deg 360deg)`,
});

const slideDirections = {
  left: { x: -44, y: 10 },
  right: { x: 44, y: 10 },
  up: { x: 0, y: 34 },
};

const getReveal = (direction = 'up') => ({
  hidden: { opacity: 0, ...slideDirections[direction] },
  visible: { opacity: 1, x: 0, y: 0 },
});

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

const revealProps = (direction = 'up', delay = 0) => ({
  variants: getReveal(direction),
  initial: 'hidden',
  whileInView: 'visible',
  viewport: { once: true, amount: 0.18 },
  transition: { ...revealTransition, delay },
});

const Home = () => {
  return (
    <main className={`${pageShell} min-h-[calc(100vh-80px)] overflow-hidden bg-[linear-gradient(90deg,rgba(24,30,42,0.028)_1px,transparent_1px),linear-gradient(180deg,rgba(24,30,42,0.026)_1px,transparent_1px),linear-gradient(180deg,#fbfbfa_0%,#f3f3f0_55%,#ededeb_100%)] bg-[length:84px_84px,84px_84px,auto]`}>
      <section className="relative min-h-[calc(100vh-80px)] overflow-hidden pb-16 pt-20 md:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[72%] bg-[radial-gradient(circle_at_18%_28%,rgba(255,255,255,0.96),transparent_26rem),radial-gradient(circle_at_76%_18%,rgba(215,222,234,0.92),transparent_30rem),linear-gradient(180deg,rgba(255,255,255,0.9),transparent)]" />
        <div className={`${maxWidth} relative grid min-h-[calc(100vh-180px)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]`}>
          <motion.div {...revealProps('left')} className="max-w-[820px]">
            <h1 className="max-w-[760px] text-[3.05rem] leading-[0.94] font-[780] tracking-normal text-[#101522] md:text-[clamp(4.1rem,6.45vw,6.85rem)]">
              Continue Your Journey
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[1.02rem] font-[760] text-[#151a25]">
              <strong className="rounded-full border border-slate-950/[0.06] bg-white/70 px-3.5 py-2.5 text-[0.9rem] font-[760] text-slate-600 shadow-[0_10px_26px_rgba(18,24,35,0.045)]">Frontend Developer</strong>
              <span>84% Complete</span>
            </div>
            <p className="mt-5 max-w-[560px] text-[1.08rem] leading-[1.7] font-[560] text-slate-500">
              Only 5 interviews remaining to complete this path.
            </p>

            <div className="mt-12 grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Current path details">
              {[
                ['Yesterday', 'Last interview completed'],
                ['84%', 'Average score'],
                ['7 days', 'Current streak'],
              ].map(([value, label]) => (
                <div key={label} className="border-t border-slate-950/10 py-4">
                  <strong className="block text-[1.28rem] font-[780] text-[#111722]">{value}</strong>
                  <span className="mt-1 block text-[0.88rem] leading-snug font-[560] text-slate-500">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <button className={primaryButton} type="button">Continue Interview</button>
              <button className={secondaryButton} type="button">View Path</button>
            </div>
          </motion.div>

          <motion.aside
            {...revealProps('right', 0.08)}
            className={`${glassCard} relative overflow-hidden rounded-[34px] p-7`}
            whileHover={{ y: -4, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 30px 70px rgba(18,24,35,0.09)' }}
          >
            <div className="flex items-center justify-between gap-5">
              <div>
                <span className="text-[0.78rem] font-[740] text-slate-400">Path status</span>
                <strong className="mt-2 block text-[1.35rem] leading-none font-[780] text-[#111722]">Frontend Developer</strong>
              </div>
              <span className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-[#edf2ed] px-3.5 text-[0.78rem] font-[780] text-[#416247]">
                <span className="size-1.5 rounded-full bg-[#416247]" />
                On track
              </span>
            </div>
            <div className="my-10 grid place-items-center">
              <div className="grid size-[220px] place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,35,0.035),0_22px_55px_rgba(19,24,35,0.1)]" style={progressBackground(84)}>
                <span className="text-[2.55rem] font-[780] text-[#171c2a]">84%</span>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-3xl bg-white/75 p-5 shadow-[inset_0_0_0_1px_rgba(18,24,35,0.045)]">
                <span className="text-[0.78rem] font-[740] text-slate-400">Next best session</span>
                <strong className="mt-2 block text-base font-[760] text-[#171c28]">React architecture review</strong>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-slate-950/[0.04] p-4">
                  <strong className="block text-[1.05rem] font-[780] text-[#111722]">5</strong>
                  <span className="mt-1 block text-[0.76rem] font-[680] text-slate-500">remaining</span>
                </div>
                <div className="rounded-[22px] bg-slate-950/[0.04] p-4">
                  <strong className="block text-[1.05rem] font-[780] text-[#111722]">7 days</strong>
                  <span className="mt-1 block text-[0.76rem] font-[680] text-slate-500">streak</span>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

      <section className="border-y border-slate-950/[0.055] bg-white/45 py-16 md:py-20">
        <div className={maxWidth}>
          <div className="mb-10 flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
            <div>
              <span className={kicker}>Tech Stack Paths</span>
              <h2 className="mt-3 text-[clamp(2.35rem,4vw,4.7rem)] leading-[0.96] font-[760] tracking-normal text-[#111722]">
                Your Interview Paths
              </h2>
            </div>
            <button className={secondaryButton} type="button">+ Create New Path</button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr_1fr] lg:auto-rows-[240px]">
            {paths.map((path) => {
              const featured = path.featured;
              const barTone = path.complete ? 'bg-[#426b4c]' : path.name.includes('JavaScript') ? 'bg-[#b08945]' : path.name.includes('System') ? 'bg-[#53617e]' : 'bg-[#171c2a]';

              return (
                <motion.article
                  {...revealProps(featured ? 'left' : path.complete ? 'right' : path.name.includes('JavaScript') ? 'up' : 'right', featured ? 0 : 0.05)}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[30px] border p-7 transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-slate-950/15 ${
                    featured
                      ? 'min-h-[420px] border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(239,244,250,0.68)),#fbfbfb] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_26px_70px_rgba(20,25,35,0.08)] lg:row-span-2 lg:p-9'
                      : 'border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_20px_45px_rgba(18,24,35,0.055)]'
                  }`}
                  key={path.name}
                  tabIndex={0}
                  whileHover={{ y: -6, scale: 1.01 }}
                  whileTap={{ scale: 0.995 }}
                >
                  {featured && <div className="pointer-events-none absolute inset-x-9 top-[108px] h-[190px] rounded-[28px] bg-[linear-gradient(90deg,rgba(18,24,35,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(18,24,35,0.045)_1px,transparent_1px)] bg-[length:34px_34px] opacity-90" />}
                  <div className="relative z-10 flex items-center justify-between gap-5">
                    <span className="text-[0.74rem] font-[800] uppercase text-slate-400">{path.meta}</span>
                    <span className="text-[0.74rem] font-[800] text-slate-400">{path.marker}</span>
                  </div>

                  <div className={`relative z-10 ${featured ? 'mt-[210px]' : 'mt-auto'}`}>
                    <span className={`mb-4 inline-flex rounded-full px-[11px] py-2 text-[0.72rem] font-[760] ${path.complete ? 'bg-[#e8eee9] text-[#3f6849]' : 'bg-[#eceef0] text-slate-500'}`}>
                      {path.badge}
                    </span>
                    <h3 className={`max-w-[360px] font-[780] leading-[1.05] text-[#111722] ${featured ? 'text-[2.45rem]' : 'text-[1.45rem]'}`}>{path.name}</h3>
                  </div>

                  <div className="relative z-10 mt-5 flex items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <strong className="text-[0.94rem] font-[760] text-[#202635]">{path.progress === 100 ? 'Completed' : `${path.progress}% Complete`}</strong>
                      <span className="text-[0.88rem] font-[560] text-slate-500">{path.remaining}</span>
                    </div>
                    <span className="text-[0.88rem] font-[760] text-[#1b202d]">Open</span>
                  </div>
                  <div className="relative z-10 mt-5 h-2 overflow-hidden rounded-full bg-slate-950/10" aria-label={`${path.name} is ${path.progress}% complete`}>
                    <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${path.progress}%` }} />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className={`${maxWidth} grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.52fr)]`}>
          <motion.div {...revealProps('left')}>
            <span className={kicker}>Recent Interviews</span>
            <h2 className="mt-3 text-[clamp(2.2rem,3.7vw,4.2rem)] leading-none font-[760] tracking-normal text-[#111722]">
              Recent activity
            </h2>
            <div className="mt-9 divide-y divide-slate-950/[0.07] border-y border-slate-950/[0.07]">
              {recentInterviews.map((interview) => (
                <article className="grid min-h-[112px] grid-cols-[1fr_auto] items-center gap-5 py-6 transition duration-200 hover:px-4" key={interview.title}>
                  <div>
                    <span className="text-[0.78rem] font-[740] uppercase text-slate-400">{interview.type}</span>
                    <h3 className="mt-2 text-[1.22rem] font-[750] text-[#151a25]">{interview.title}</h3>
                    <small className="mt-1 block text-[0.9rem] font-[560] text-slate-500">{interview.date}</small>
                  </div>
                  <strong className="text-[1.65rem] font-[760] text-[#171c2a]">{interview.score}</strong>
                </article>
              ))}
            </div>
          </motion.div>

          <motion.aside
            {...revealProps('right', 0.08)}
            className="rounded-[34px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_60px_rgba(18,24,35,0.065)] md:p-9"
            whileHover={{ y: -4, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 30px 70px rgba(18,24,35,0.085)' }}
          >
            <div className="flex items-center justify-between gap-5">
              <span className="text-[0.74rem] font-[800] uppercase text-slate-400">AI Recommendation</span>
              <span className="text-[0.74rem] font-[800] text-slate-400">Next</span>
            </div>
            <h2 className="mt-10 text-[2.45rem] leading-none font-[780] tracking-normal text-[#121722]">Recommended Next</h2>
            <div className="my-8 rounded-[28px] border border-slate-950/[0.055] bg-white/58 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <span className="text-[0.78rem] font-[740] text-slate-400">Suggested Interview</span>
              <strong className="mt-2 block text-[1.42rem] leading-[1.2] font-[780] text-[#171c2a]">System Design Interview</strong>
            </div>
            <p className="max-w-[360px] text-[0.92rem] leading-[1.75] font-[560] text-slate-500">
              Based on your recent progress, you're ready to begin architecture-focused interviews.
            </p>
            <button className={`${primaryButton} mt-8`} type="button">Start Practice</button>
          </motion.aside>
        </div>
      </section>

      <section className="pb-20">
        <div className={`${maxWidth} grid gap-10 xl:grid-cols-[0.82fr_1.18fr] xl:items-center`}>
          <motion.div {...revealProps('left')}>
            <span className={kicker}>Progress Snapshot</span>
            <h2 className="mt-3 max-w-[520px] text-[clamp(2.25rem,3.8vw,4.4rem)] leading-[0.98] font-[760] tracking-normal text-[#111722]">
              Readiness without dashboard noise.
            </h2>
          </motion.div>
          <div className="grid gap-7 md:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              {...revealProps('up', 0.06)}
              className="flex h-[300px] items-center rounded-[34px] border border-slate-950/[0.055] bg-[linear-gradient(90deg,rgba(18,24,35,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(18,24,35,0.04)_1px,transparent_1px),linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] bg-[length:42px_42px,42px_42px,auto] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_55px_rgba(18,24,35,0.055)]"
              aria-label="Growth chart showing steady improvement"
              whileHover={{ y: -4 }}
            >
              <svg className="h-full w-full overflow-visible" viewBox="0 0 420 150" role="img" aria-hidden="true" focusable="false">
                <path fill="rgba(18,24,35,0.09)" d="M10 122 C70 114 88 96 132 101 C178 106 183 67 230 72 C282 77 306 43 358 37 C385 34 403 26 410 22 L410 150 L10 150 Z" />
                <path fill="none" stroke="#151a25" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" d="M10 122 C70 114 88 96 132 101 C178 106 183 67 230 72 C282 77 306 43 358 37 C385 34 403 26 410 22" />
              </svg>
            </motion.div>

            <motion.div {...revealProps('right', 0.1)} className="grid content-center gap-[18px]">
              {scores.map((score) => (
                <div className="grid grid-cols-[1fr_86px_34px] items-center gap-3.5 md:grid-cols-[1fr_minmax(120px,170px)_38px]" key={score.label}>
                  <span className="text-[0.9rem] font-[680] text-slate-600">{score.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-950/10">
                    <span className="block h-full rounded-full bg-[#171c2a]" style={{ width: `${score.value}%` }} />
                  </div>
                  <strong className="text-right text-[0.95rem] font-[760] text-[#171c2a]">{score.value}</strong>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
