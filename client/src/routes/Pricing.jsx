import React from "react";
import { motion } from "framer-motion";

const pageShell = "font-[Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#151923] [&_*]:box-border [&_*]:font-[inherit]";
const maxWidth = "mx-auto w-full max-w-[1480px] px-5 md:px-8 xl:px-10";
const kicker = "inline-flex items-center gap-2.5 text-[0.74rem] font-[780] uppercase text-slate-500 before:block before:size-2 before:rounded-full before:bg-slate-950/20";

const plans = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    tag: "Start here",
    description: "For exploring RIVR and getting familiar with AI interview practice.",
    cta: "Start Free",
    features: [
      "3 mock interviews per month",
      "Basic AI feedback summary",
      "Frontend fundamentals path",
      "Recent interview history",
      "Resume upload preview",
    ],
  },
  {
    name: "Plus",
    price: "₹49999",
    cadence: "per month",
    tag: "Most popular",
    description: "For active candidates preparing weekly with deeper feedback and more paths.",
    cta: "Upgrade to Plus",
    featured: true,
    features: [
      "30 mock interviews per month",
      "Detailed technical + communication scores",
      "All role-based interview paths",
      "AI recommendations for next practice",
      "Resume-aware question preparation",
      "Priority session history and analytics",
    ],
  },
  {
    name: "Pro",
    price: "₹7 Crore",
    cadence: "per month",
    tag: "Serious prep",
    description: "For intensive preparation, placement season, and high-stakes interview loops.",
    cta: "Go Pro",
    features: [
      "Unlimited mock interviews",
      "Advanced system design rounds",
      "Project deep-dive interview mode",
      "Personalized weakness drills",
      "Exportable progress reports",
      "Early access to new interview models",
    ],
  },
];

const reveal = (direction = "up", delay = 0) => ({
  initial: { opacity: 0, x: direction === "left" ? -42 : direction === "right" ? 42 : 0, y: direction === "up" ? 32 : 10 },
  whileInView: { opacity: 1, x: 0, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

const Pricing = () => {
  return (
    <main className={`${pageShell} min-h-screen overflow-hidden bg-[linear-gradient(90deg,rgba(24,30,42,0.028)_1px,transparent_1px),linear-gradient(180deg,rgba(24,30,42,0.026)_1px,transparent_1px),linear-gradient(180deg,#fbfbfa_0%,#f3f3f0_55%,#ededeb_100%)] bg-[length:84px_84px,84px_84px,auto] pb-20 pt-28 md:pt-32`}>
      <section className={maxWidth}>
        <div className="grid gap-8 pb-12 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <motion.div {...reveal("left")}>
            <span className={kicker}>Pricing</span>
            <h1 className="mt-5 max-w-[860px] text-[clamp(3.4rem,6vw,7rem)] leading-[0.93] font-[780] tracking-normal text-[#101522]">
              Choose your interview edge.
            </h1>
            <p className="mt-6 max-w-[660px] text-[1.04rem] leading-[1.75] font-[560] text-slate-500">
              Start free, then upgrade when your preparation needs deeper feedback, more interviews, and sharper progress tracking.
            </p>
          </motion.div>

          <motion.aside
            {...reveal("right", 0.08)}
            className="rounded-[34px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_60px_rgba(18,24,35,0.06)]"
          >
            <span className="text-[0.74rem] font-[800] uppercase text-slate-400">Billing note</span>
            <strong className="mt-3 block text-[1.45rem] leading-tight font-[780] text-[#111722]">
              Indian pricing, built for students and early career candidates.
            </strong>
            <p className="mt-3 text-[0.92rem] leading-relaxed font-[560] text-slate-500">
              Dummy prices for now. Payment and subscription logic can be wired later.
            </p>
          </motion.aside>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.article
              {...reveal(index === 0 ? "left" : index === 2 ? "right" : "up", index * 0.05)}
              className={`relative flex min-h-[540px] flex-col overflow-hidden rounded-[30px] border p-6 transition duration-200 ${
                plan.featured
                  ? "border-slate-950/10 bg-[linear-gradient(155deg,#1a202d_0%,#111722_62%,#202533_100%)] text-white shadow-[0_34px_90px_rgba(20,25,35,0.18)]"
                  : "border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.58)),#fbfbfb] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_60px_rgba(18,24,35,0.06)]"
              }`}
              key={plan.name}
              whileHover={{ y: -7, scale: 1.01 }}
            >
              {plan.featured && (
                <div className="pointer-events-none absolute inset-x-6 top-24 h-[190px] rounded-[26px] bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:34px_34px] opacity-70" />
              )}
              <div className="relative z-10 flex items-center justify-between gap-5">
                <span className={`text-[0.74rem] font-[800] uppercase ${plan.featured ? "text-white/52" : "text-slate-400"}`}>
                  {plan.tag}
                </span>
                <span className={`rounded-full px-3 py-1.5 text-[0.76rem] font-[760] ${plan.featured ? "bg-white/10 text-white/78" : "bg-slate-950/[0.06] text-slate-500"}`}>
                  {plan.name}
                </span>
              </div>

              <div className="relative z-10 mt-9">
                <h2 className={`text-[2.15rem] leading-none font-[780] ${plan.featured ? "text-white" : "text-[#111722]"}`}>{plan.name}</h2>
                <p className={`mt-3 min-h-[64px] text-[0.92rem] leading-relaxed font-[560] ${plan.featured ? "text-white/62" : "text-slate-500"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="relative z-10 mt-6 flex items-end gap-2">
                <strong className={`text-[3.15rem] leading-none font-[780] ${plan.featured ? "text-white" : "text-[#111722]"}`}>{plan.price}</strong>
                <span className={`pb-1.5 text-[0.88rem] font-[620] ${plan.featured ? "text-white/54" : "text-slate-500"}`}>{plan.cadence}</span>
              </div>

              <div className={`relative z-10 my-6 h-px ${plan.featured ? "bg-white/14" : "bg-slate-950/10"}`} />

              <ul className="relative z-10 grid gap-3">
                {plan.features.map((feature) => (
                  <li
                    className={`group flex items-start gap-3 rounded-[16px] px-2 py-1.5 transition duration-200 ${
                      plan.featured
                        ? "hover:bg-white/[0.055]"
                        : "hover:bg-white/70"
                    }`}
                    key={feature}
                  >
                    <span
                      className={`mt-2 size-1.5 shrink-0 rounded-full transition duration-200 ${
                        plan.featured
                          ? "bg-white/88 group-hover:scale-125"
                          : "bg-[#111722] group-hover:scale-125"
                      }`}
                    />
                    <span className={`text-[0.91rem] leading-relaxed font-[650] ${plan.featured ? "text-white/78" : "text-slate-600"}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`group relative z-10 mt-9 inline-flex min-h-[50px] cursor-pointer items-center justify-center overflow-hidden rounded-full px-5 text-[0.9rem] font-[800] transition duration-200 hover:-translate-y-0.5 ${
                  plan.featured
                    ? "bg-white text-[#111722] shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
                    : "border border-slate-950/[0.08] bg-[#111722] text-white shadow-[0_18px_36px_rgba(18,24,35,0.14)]"
                }`}
                type="button"
              >
                <span className={`absolute inset-0 -translate-x-full opacity-0 transition duration-500 group-hover:translate-x-0 group-hover:opacity-100 ${plan.featured ? "bg-[linear-gradient(110deg,transparent,rgba(15,23,42,0.08),transparent)]" : "bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)]"}`} />
                <span className="relative flex items-center gap-3">
                  {plan.cta}
                  <span className={`grid size-7 place-items-center rounded-full text-[0.85rem] transition duration-200 group-hover:translate-x-0.5 ${plan.featured ? "bg-slate-950 text-white" : "bg-white text-[#111722]"}`}>
                    -&gt;
                  </span>
                </span>
              </button>
            </motion.article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Pricing;
