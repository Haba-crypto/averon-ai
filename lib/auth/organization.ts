import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { requireUser } from "@/lib/auth/session";

type OrganizationMembership = {
  organization_id: string;
  role?: string | null;
};

export async function requireOrganizationContext() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<OrganizationMembership>();

  if (error || !data) {
    throw new Error("Organization context not found");
  }

  return {
    supabase,
    user,
    organizationId: data.organization_id,
    role: data.role ?? null,
  };
}

export async function requireApiOrganizationContext() {
  const auth = await requireApiUser();

  if (auth.response || !auth.user) {
    return {
      ...auth,
      organizationId: null,
      role: null,
    };
  }

  const { data, error } = await auth.supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle<OrganizationMembership>();

  if (error || !data) {
    return {
      ...auth,
      organizationId: null,
      role: null,
      response: NextResponse.json(
        {
          error: "Organization context not found",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    ...auth,
    organizationId: data.organization_id,
    role: data.role ?? null,
  };
}
