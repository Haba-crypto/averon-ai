import type { SupabaseClient } from "@supabase/supabase-js";

import {
  agentProfiles,
  buildAgentIdentityContext,
  getAgentProfileForActiveAgent,
  type AgentProfile,
} from "@/lib/agents/agent-profiles";

export type ResolvedAgentIdentity = {
  profile: AgentProfile;
  agentId: string | null;
  identityContext: string;
};

type AgentRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
};

export async function resolveAgentIdentityForChat({
  supabase,
  organizationId,
  activeAgent,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  activeAgent: string;
}): Promise<ResolvedAgentIdentity | null> {
  const profile = getAgentProfileForActiveAgent(activeAgent);

  if (!profile) {
    return null;
  }

  let agentId: string | null = null;

  try {
    const agentsByKey = await ensureAgentProfilesForOrganization({
      supabase,
      organizationId,
    });
    agentId = agentsByKey.get(profile.key)?.id ?? null;
  } catch (error) {
    console.error("AGENT IDENTITY RESOLUTION FAILED", {
      organizationId,
      activeAgent,
      error,
    });
  }

  return {
    profile,
    agentId,
    identityContext: buildAgentIdentityContext(profile),
  };
}

export function serializeAgentIdentity(
  identity: ResolvedAgentIdentity | null
) {
  if (!identity) {
    return null;
  }

  return {
    agent_id: identity.agentId,
    agent_key: identity.profile.key,
    agent_name: identity.profile.name,
    agent_role: identity.profile.role,
    objective: identity.profile.objective,
    description: identity.profile.description,
    responsibilities: identity.profile.responsibilities,
    behavior_profile: identity.profile.behaviorProfile,
    prompt_profile: identity.profile.promptProfile,
  };
}

export function buildAgentExecutionIdentityFields(
  identity: ResolvedAgentIdentity | null
) {
  const serializedAgentIdentity = serializeAgentIdentity(identity);

  return {
    agent_id: identity?.agentId ?? null,
    agent_name: identity?.profile.name ?? null,
    agent_role: identity?.profile.role ?? null,
    metadata: {
      source: "api.chat",
      agent_identity: serializedAgentIdentity,
    },
  };
}

async function ensureAgentProfilesForOrganization({
  supabase,
  organizationId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
}) {
  const seedRows = agentProfiles.map((profile) => ({
    organization_id: organizationId,
    key: profile.key,
    name: profile.name,
    description: profile.description,
    status: "active",
    config: {
      role: profile.role,
      objective: profile.objective,
      responsibilities: profile.responsibilities,
      behavior_profile: profile.behaviorProfile,
      prompt_profile: profile.promptProfile,
      phase: 9,
    },
  }));

  const { error: upsertError } = await supabase
    .from("agents")
    .upsert(seedRows, {
      onConflict: "organization_id,key",
    });

  if (upsertError) {
    throw upsertError;
  }

  const { data, error: selectError } = await supabase
    .from("agents")
    .select("id, key, name, description, config")
    .eq("organization_id", organizationId)
    .in(
      "key",
      agentProfiles.map((profile) => profile.key)
    );

  if (selectError) {
    throw selectError;
  }

  return new Map(
    ((data ?? []) as AgentRow[]).map((row) => [row.key, row])
  );
}
