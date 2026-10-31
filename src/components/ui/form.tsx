import { cn } from "@/lib/utils";

export function Field({ label, hint, className, children, full }: { label: string; hint?: string; className?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", full && "sm:col-span-2", className)}>
      <span className="text-[13px] font-semibold text-ink/85">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn("field", p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn("field", p.className)} />;
export function Select({ options, placeholder, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | [string, string])[]; placeholder?: string }) {
  return (
    <select {...p} className={cn("field pr-8", p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm font-medium"
    >
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      {label}
    </button>
  );
}
