import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // le modèle 3D du dépôt (.glb) et le décodeur Draco (/draco/) sont des fichiers statiques : pas de session à vérifier
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|draco/|.*\\.(?:png|jpg|jpeg|svg|webp|glb|wasm)$).*)"],
};
