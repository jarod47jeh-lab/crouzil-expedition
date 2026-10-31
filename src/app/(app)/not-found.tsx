import Link from "next/link";
import { Card, Empty } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card>
      <Empty title="Élément introuvable">
        Il a peut-être été supprimé. <Link href="/corbeille" className="text-brand underline">Voir la corbeille</Link>
      </Empty>
    </Card>
  );
}
