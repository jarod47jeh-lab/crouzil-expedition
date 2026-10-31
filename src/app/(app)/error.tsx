"use client";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <Empty title="Une erreur est survenue">
        <p className="mb-3">{error.message}</p>
        <Button onClick={reset}>Réessayer</Button>
      </Empty>
    </Card>
  );
}
