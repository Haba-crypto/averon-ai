import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function requireApiUser() {
  const { supabase, user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      ),
    };
  }

  return {
    supabase,
    user,
    response: null,
  };
}
