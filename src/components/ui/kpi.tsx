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
  const color = { ink: "text-ink", ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info", brand: "text-brand", violet: "text-violet" }[tone];
  const bg = { ink: "bg-surface-2 text-muted", ok: "bg-ok/12 text-ok", warn: "bg-warn/14 text-warn", bad: "bg-bad/12 text-bad", info: "bg-info/12 text-info", brand: "bg-brand/12 text-brand", violet: "bg-violet/12 text-violet" }[tone];
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={href ? { y: -3 } : undefined}
      className={cn("group relative h-full overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card", href && "cursor-pointer hover:border-brand/40")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-semibold tracking-wide text-muted uppercase">{label}</p>
        {icon && <span className={cn("grid h-9 w-9 place-items-center rounded-xl", bg)}>{icon}</span>}
      </div>
      <p className={cn("tabular mt-2 font-display text-[34px] leading-none font-bold", color)}>
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
