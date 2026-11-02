import { AcceptForm } from "./accept-form";

export const metadata = { title: "Activer mon accès" };

export default async function AcceptPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const sp = await searchParams;
  return <AcceptForm tokenHash={sp.token_hash || ""} type={sp.type === "recovery" ? "recovery" : "invite"} />;
}
