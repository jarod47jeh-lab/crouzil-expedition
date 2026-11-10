/* eslint-disable @next/next/no-img-element */
/** Capsule Crouzil Boissons */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/logo-crouzil.png" alt="" aria-hidden className={className + " object-contain"} width={256} height={256} />;
}
