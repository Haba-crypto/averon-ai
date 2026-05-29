import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkItemOwnerType =
  | "ai"
  | "human"
  | "shared"
  | "unassigned";

export type WorkItemOwnershipStatus =
  | "unassigned"
  | "assigned"
  | "transferred"
  | "human_review"
  | "ready_to_resume"
  | "blocked"
  | "completed";

export type WorkItemOwnershipAgent = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
};

export type UpdateWorkItemOwnershipInput = {
  supabase: SupabaseClient;
  workItemId: string;
  organizationId: string;
  ownerType: WorkItemOwnerType;
  ownerAgentId?: string | null;
  ownerAgentName?: string | null;
  ownerAgentRole?: string | null;
  ownerUserId?: string | null;
  reason?: string | null;
  sourceAgent?: WorkItemOwnershipAgent | string | null;
  targetAgent?: WorkItemOwnershipAgent | string | null;
  ownershipStatus?: WorkItemOwnershipStatus | null;
};

export type WorkItemOwnershipRecord = {
  id: string;
  owner_type: WorkItemOwnerType;
  owner_agent_id: string | null;
  owner_agent_name: string | null;
  owner_agent_role: string | null;
  owner_user_id: string | null;
  ownership_status: WorkItemOwnershipStatus;
  last_owner_change_at: string | null;
  last_owner_change_reason: string | null;
};

export async function updateWorkItemOwnership({
  supabase,
  workItemId,
  organizationId,
  ownerType,
  ownerAgentId = null,
  ownerAgentName = null,
  ownerAgentRole = null,
  ownerUserId = null,
  reason = null,
  sourceAgent = null,
  targetAgent = null,
  ownershipStatus = null,
}: UpdateWorkItemOwnershipInput) {
  const { data: existingWorkItem, error: existingError } =
    await supabase
      .from("work_items")
      .select(
        [
          "id",
          "owner_type",
          "owner_agent_id",
          "owner_agent_name",
          "owner_agent_role",
          "owner_user_id",
          "ownership_status",
          "last_owner_change_at",
          "last_owner_change_reason",
        ].join(", ")
      )
      .eq("id", workItemId)
      .eq("organization_id", organizationId)
      .single<WorkItemOwnershipRecord>();

  if (existingError) {
    throw existingError;
  }

  const normalizedSourceAgent =
    normalizeOwnershipAgent(sourceAgent) ??
    normalizeOwnershipAgent({
      id: existingWorkItem.owner_agent_id,
      name: existingWorkItem.owner_agent_name,
      role: existingWorkItem.owner_agent_role,
    });
  const normalizedTargetAgent =
    normalizeOwnershipAgent(targetAgent) ??
    normalizeOwnershipAgent({
      id: ownerAgentId,
      name: ownerAgentName,
      role: ownerAgentRole,
    });
  const status =
    ownershipStatus ??
    resolveOwnershipStatus({
      ownerType,
      previous: existingWorkItem,
      ownerAgentId,
      ownerAgentName,
    });
  const changedAt = new Date().toISOString();

  const { data: updatedWorkItem, error: updateError } =
    await supabase
      .from("work_items")
      .update({
        owner_type: ownerType,
        owner_agent_id:
          ownerType === "ai" || ownerType === "shared"
            ? ownerAgentId
            : null,
        owner_agent_name:
          ownerType === "ai" || ownerType === "shared"
            ? ownerAgentName
            : null,
        owner_agent_role:
          ownerType === "ai" || ownerType === "shared"
            ? ownerAgentRole
            : null,
        owner_user_id:
          ownerType === "human" || ownerType === "shared"
            ? ownerUserId
            : null,
        ownership_status: status,
        last_owner_change_at: changedAt,
        last_owner_change_reason: reason,
        updated_at: changedAt,
      })
      .eq("id", workItemId)
      .eq("organization_id", organizationId)
      .select(
        [
          "id",
          "owner_type",
          "owner_agent_id",
          "owner_agent_name",
          "owner_agent_role",
          "owner_user_id",
          "ownership_status",
          "last_owner_change_at",
          "last_owner_change_reason",
        ].join(", ")
      )
      .single<WorkItemOwnershipRecord>();

  if (updateError) {
    throw updateError;
  }

  const decision = buildOwnershipDecision({
    previous: existingWorkItem,
    updated: updatedWorkItem,
    sourceAgent: normalizedSourceAgent,
    targetAgent: normalizedTargetAgent,
    reason,
    changedAt,
  });

  const { error: decisionError } = await supabase
    .from("agent_decisions")
    .insert({
      organization_id: organizationId,
      agent_id: ownerType === "ai" ? ownerAgentId : null,
      work_item_id: workItemId,
      decision_type: "ownership_change",
      decision: {
        outcome: decision,
      },
      rationale: buildOwnershipRationale(decision),
      confidence: 1,
      metadata: {
        source: "work_item_ownership",
        work_item_id: workItemId,
        owner_type: ownerType,
        ownership_status: status,
        source_agent: normalizedSourceAgent?.name ?? null,
        target_agent: normalizedTargetAgent?.name ?? null,
        reason,
        changed_at: changedAt,
      },
    });

  if (decisionError) {
    throw decisionError;
  }

  return {
    previous: existingWorkItem,
    workItem: updatedWorkItem,
    decision,
  };
}

export function isWorkItemOwnerEmpty(
  workItem: Pick<
    WorkItemOwnershipRecord,
    "owner_type" | "owner_agent_id" | "owner_user_id"
  > | null
) {
  if (!workItem) {
    return false;
  }

  return (
    workItem.owner_type === "unassigned" &&
    !workItem.owner_agent_id &&
    !workItem.owner_user_id
  );
}

function resolveOwnershipStatus({
  ownerType,
  previous,
  ownerAgentId,
  ownerAgentName,
}: {
  ownerType: WorkItemOwnerType;
  previous: WorkItemOwnershipRecord;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
}): WorkItemOwnershipStatus {
  if (ownerType === "unassigned") {
    return "unassigned";
  }

  if (ownerType === "human" || ownerType === "shared") {
    return "human_review";
  }

  const hadOwner =
    previous.owner_type !== "unassigned" ||
    Boolean(previous.owner_agent_id) ||
    Boolean(previous.owner_user_id);
  const sameAgent =
    previous.owner_agent_id === ownerAgentId &&
    previous.owner_agent_name === ownerAgentName;

  return hadOwner && !sameAgent ? "transferred" : "assigned";
}

function normalizeOwnershipAgent(
  agent: WorkItemOwnershipAgent | string | null | undefined
): WorkItemOwnershipAgent | null {
  if (!agent) {
    return null;
  }

  if (typeof agent === "string") {
    return {
      name: agent,
    };
  }

  if (!agent.id && !agent.name && !agent.role) {
    return null;
  }

  return {
    id: agent.id ?? null,
    name: agent.name ?? null,
    role: agent.role ?? null,
  };
}

function buildOwnershipDecision({
  previous,
  updated,
  sourceAgent,
  targetAgent,
  reason,
  changedAt,
}: {
  previous: WorkItemOwnershipRecord;
  updated: WorkItemOwnershipRecord;
  sourceAgent: WorkItemOwnershipAgent | null;
  targetAgent: WorkItemOwnershipAgent | null;
  reason: string | null;
  changedAt: string;
}) {
  return {
    work_item_id: updated.id,
    previous_owner: {
      owner_type: previous.owner_type,
      owner_agent_id: previous.owner_agent_id,
      owner_agent_name: previous.owner_agent_name,
      owner_agent_role: previous.owner_agent_role,
      owner_user_id: previous.owner_user_id,
      ownership_status: previous.ownership_status,
    },
    new_owner: {
      owner_type: updated.owner_type,
      owner_agent_id: updated.owner_agent_id,
      owner_agent_name: updated.owner_agent_name,
      owner_agent_role: updated.owner_agent_role,
      owner_user_id: updated.owner_user_id,
      ownership_status: updated.ownership_status,
    },
    source_agent: sourceAgent,
    target_agent: targetAgent,
    reason,
    changed_at: changedAt,
  };
}

function buildOwnershipRationale(decision: {
  previous_owner: {
    owner_type: WorkItemOwnerType;
    owner_agent_name: string | null;
  };
  new_owner: {
    owner_type: WorkItemOwnerType;
    owner_agent_name: string | null;
  };
  reason: string | null;
}) {
  const previousOwner = formatOwner(
    decision.previous_owner.owner_type,
    decision.previous_owner.owner_agent_name
  );
  const newOwner = formatOwner(
    decision.new_owner.owner_type,
    decision.new_owner.owner_agent_name
  );
  const reason = decision.reason
    ? ` Reason: ${decision.reason}`
    : "";

  return `Work ownership changed from ${previousOwner} to ${newOwner}.${reason}`;
}

function formatOwner(
  ownerType: WorkItemOwnerType,
  agentName: string | null
) {
  if (ownerType === "ai" && agentName) {
    return agentName;
  }

  if (ownerType === "human") {
    return "Human Review";
  }

  if (ownerType === "shared") {
    return "Shared Human Review";
  }

  return "unassigned";
}
