export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M14 22h22v18H14zM36 28h8l6 6v6H36" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="22" cy="44" r="4" fill="#fff" />
      <circle cx="44" cy="44" r="4" fill="#fff" />
    </svg>
  );
}
