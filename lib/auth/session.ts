import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function requireUser() {
  const { supabase, user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    supabase,
    user,
  };
}
