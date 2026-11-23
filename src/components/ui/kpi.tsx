"use client";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn, nf } from "@/lib/utils";

export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => nf(v, decimals) + suffix);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Kpi({
  label,
  value,
  decimals,
  suffix,
  sub,
  tone = "ink",
  icon,
  href,
  index = 0,
  children,
}: {
  label: string;
  value: number | null;
  decimals?: number;
  suffix?: string;
  sub?: React.ReactNode;
  tone?: "ink" | "ok" | "warn" | "bad" | "info" | "brand" | "violet";
  icon?: React.ReactNode;
  href?: string;
  index?: number;
  children?: React.ReactNode;
}) {
  // Un chiffre ne prend de la couleur que s il signale quelque chose à traiter ; le reste reste à l encre.
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  void icon; // les cartes de chiffres restent des chiffres : pas de vignette décorative
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
     
      className={cn("group relative h-full overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors", href && "cursor-pointer hover:border-ink/20")}
    >
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("tabular mt-2 text-[32px] leading-none font-medium", color)}>
        {value == null ? "–" : <CountUp value={value} decimals={decimals} suffix={suffix} />}
      </p>
      {sub && <div className="mt-2 text-[13px] text-muted">{sub}</div>}
      {children}
    </motion.div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
