"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Tabs({ tabs, active, id = "tabs" }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; id?: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 shadow-card">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          className={cn("relative rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors", active === t.key ? "text-brand-ink" : "text-muted hover:text-ink")}
        >
          {active === t.key && (
            <motion.span layoutId={id} className="absolute inset-0 rounded-xl bg-brand" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className="relative inline-flex items-center gap-2">
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px] leading-5", active === t.key ? "bg-white/25" : "bg-surface-2")}>{t.count}</span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
