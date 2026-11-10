"use client";
import { motion } from "motion/react";

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand sm:grid">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight sm:text-[30px]">{title}</h1>
          {subtitle && <p className="mt-1 line-clamp-2 text-[13px] text-muted sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
