"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import SectionHeading from "../SectionHeading";

const ACCENT = "#5ff2ff";

const TIERS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    highlight: false,
    credits: "25 credits/month",
    unlocks: "5 internship application unlocks/month",
    features: [
      "Prophezy AI",
      "AI Notes",
      "Exam Predictor",
      "ATS / Resume Scan",
      "Interview AI",
      "Career Guidance",
      "Research Papers",
      "Research Topic Explorer",
      "Hackathons",
      "Project Library",
      "Internship Discovery",
      "Resume Builder",
      "Basic platform access",
      "Community/basic support",
    ],
  },
  {
    name: "Pro",
    price: "₹75",
    period: "/ month",
    highlight: true,
    credits: "500 credits/month",
    unlocks: "25 internship application unlocks/month",
    features: [
      "Everything in Free",
      "Full internship discovery",
      "Full Research Library",
      "Topic Explorer",
      "Full Project Library",
      "AI Notes",
      "ATS / Resume Analysis",
      "Resume Builder",
      "Interview AI",
      "Exam Predictor",
      "Career Guidance AI",
      "Prophezy AI",
      "Hackathon discovery",
      "Advanced research tools",
      "Priority access to new features",
    ],
  },
  {
    name: "Premium",
    price: "₹100",
    period: "/ month",
    highlight: false,
    credits: "700 credits/month",
    unlocks: "Unlimited internship application unlocks",
    features: [
      "Everything in Pro",
      "Full access to the entire Prophezy platform",
      "Full Research Library",
      "Full Topic Explorer",
      "Full Project Library",
      "Prophezy AI",
      "AI Notes",
      "Advanced ATS / Resume tools",
      "Interview AI",
      "Exam Predictor",
      "Career Guidance AI",
      "Hackathon discovery",
      "Research AI",
      "Priority AI experience",
      "Early access to new features",
      "Premium support",
      "Highest monthly usage allowance",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          index="10"
          tag="Pricing"
          title="Replace fifteen subscriptions with one."
          description="Every plan includes the core operating system. Pro unlocks the full intelligence layer."
          color={ACCENT}
          align="center"
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative flex flex-col rounded-2xl border p-7"
              style={
                tier.highlight
                  ? {
                      borderColor: "rgba(95,242,255,0.4)",
                      background: "radial-gradient(circle at 50% 0%, rgba(95,242,255,0.08), rgba(255,255,255,0.02))",
                      boxShadow: "0 0 50px rgba(95,242,255,0.12)",
                    }
                  : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }
              }
            >
              {tier.highlight && (
                <span
                  className="absolute -top-3 left-7 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#050505]"
                  style={{ backgroundColor: ACCENT }}
                >
                  Most popular
                </span>
              )}
              <div className="mb-1 text-sm text-[var(--dim)]">{tier.name}</div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-4xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {tier.price}
                </span>
                <span className="text-xs text-[var(--dim)]">{tier.period}</span>
              </div>
              <div className="mb-6 space-y-0.5">
                <p className="text-xs text-white/50">{tier.credits}</p>
                <p className="text-xs text-white/50">{tier.unlocks}</p>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`inline-flex items-center justify-center rounded-full py-3 text-sm font-medium transition-transform hover:-translate-y-0.5 ${
                  tier.highlight ? "text-[#050505]" : "border border-white/15 text-white"
                }`}
                style={tier.highlight ? { backgroundColor: ACCENT } : undefined}
              >
                Get started
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
