"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Affiché quand on arrive sur une page dont le menu n'est pas ouvert à ce compte */
export function RefusedToast() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (params.get("refus")) {
      toast.error("Ce menu n'est pas ouvert à votre compte. Demandez l'accès à un administrateur.");
      router.replace("/");
    }
  }, [params, router]);
  return null;
}
