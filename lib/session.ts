import { auth } from "@/lib/auth-server";

export async function getSession() {
  return await auth();
}

