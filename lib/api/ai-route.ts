import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/api";

export async function requireAuthenticatedAiRequest() {
  const auth = await requireApiUser();

  if (auth.response || !auth.user) {
    return auth;
  }

  return {
    ...auth,
    response: null as NextResponse | null,
  };
}
