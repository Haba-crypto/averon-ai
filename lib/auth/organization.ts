import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { requireUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

type OrganizationMembership = {
  organization_id: string;
  role?: string | null;
};

async function getOrganizationMembershipForUser(userId: string) {
  return supabaseAdmin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<OrganizationMembership>();
}

export async function requireOrganizationContext() {
  const { supabase, user } = await requireUser();

  const { data, error } =
    await getOrganizationMembershipForUser(user.id);

  if (error) {
    console.error("ORGANIZATION MEMBERSHIP QUERY ERROR:", {
      userId: user.id,
      error,
    });

    throw new Error("Organization context lookup failed");
  }

  if (!data) {
    console.warn("ORGANIZATION MEMBERSHIP NOT FOUND:", {
      userId: user.id,
    });

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

  const { data, error } =
    await getOrganizationMembershipForUser(auth.user.id);

  if (error) {
    console.error("API ORGANIZATION MEMBERSHIP QUERY ERROR:", {
      userId: auth.user.id,
      error,
    });

    return {
      ...auth,
      organizationId: null,
      role: null,
      response: NextResponse.json(
        {
          error: "Organization context lookup failed",
        },
        {
          status: 500,
        }
      ),
    };
  }

  if (!data) {
    console.warn("API ORGANIZATION MEMBERSHIP NOT FOUND:", {
      userId: auth.user.id,
    });

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
