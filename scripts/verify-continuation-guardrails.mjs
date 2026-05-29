import fs from "fs";
import Module from "module";
import { createRequire } from "module";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAveronAlias(
  request,
  parent,
  isMain,
  options
) {
  if (request.startsWith("@/")) {
    return path.join(rootDir, request.slice(2)) + ".ts";
  }

  return originalResolveFilename.call(
    this,
    request,
    parent,
    isMain,
    options
  );
};

Module._extensions[".ts"] = function compileTypescriptModule(
  mod,
  filename
) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  mod._compile(compiled, filename);
};

function loadModule(relativePath) {
  return require(path.join(rootDir, relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createRuntimeContext({
  organizationId,
  queueItemId,
  parentWorkItemId,
  reviewId,
  agentId,
  reviewStatus = "approved",
  continuationDepth = 0,
}) {
  return {
    organization_id: organizationId,
    queue_item: {
      id: queueItemId,
      status: "completed",
      assigned_agent_name: "Operations Agent",
      queue_reason: "Approved; continue with operations.",
      next_action: "Resume operations workflow.",
      review_id: reviewId,
      source_decision_id: null,
      metadata: {
        continuation_depth: continuationDepth,
      },
    },
    work_item: {
      id: parentWorkItemId,
      type: "lead_acquisition",
      status: "in_progress",
      owner_type: "ai",
      owner_agent_name: "Operations Agent",
      ownership_status: "ready_to_resume",
      last_owner_change_reason: "approved human review",
    },
    lead: {
      id: `lead-${parentWorkItemId}`,
      name: "Ada Buyer",
      email: "ada@example.com",
      status: "qualified",
      intent_score: 91,
      urgency: "high",
    },
    assigned_agent: {
      id: agentId,
      key: "operations",
      name: "Operations Agent",
      description: "Coordinates controlled execution.",
      role: "Revenue Operations",
    },
    ownership: {
      owner_type: "ai",
      owner_agent_name: "Operations Agent",
      ownership_status: "ready_to_resume",
      last_owner_change_reason: "approved human review",
    },
    memory_context: {
      facts: [],
      preferences: [],
      risks: [],
      decisions: [],
      summaries: [],
    },
    human_review_context: {
      id: reviewId,
      review_title: "Resume Operations",
      review_summary: "Human reviewed the next execution step.",
      recommended_action: "Resume operations workflow.",
      status: reviewStatus,
      review_outcome:
        reviewStatus === "approved" ? "Approved" : "Rejected",
      review_notes:
        reviewStatus === "approved"
          ? "Approved; continue."
          : "Do not continue.",
      reviewed_at: new Date().toISOString(),
    },
    recent_timeline: [],
    recommended_next_action: "Resume operations workflow.",
    safety_flags: [],
  };
}

function createFakeSupabase(label, { includeAgent = true } = {}) {
  const organizationId = `org-phase-24-${label}`;
  const parentWorkItemId = `work-item-phase-24-${label}`;
  const queueItemId = `queue-phase-24-${label}`;
  const agentId = `agent-phase-24-${label}`;
  const reviewId = `review-phase-24-${label}`;
  const now = new Date().toISOString();
  const transitions = [];
  const state = {
    workItems: [
      {
        id: parentWorkItemId,
        organization_id: organizationId,
        title: "Lead acquisition for Ada Buyer",
        type: "lead_acquisition",
        status: "queued",
        priority: "high",
        source_type: "lead",
        source_id: `lead-phase-24-${label}`,
        lead_id: `lead-phase-24-${label}`,
        parent_work_item_id: null,
        owner_type: "ai",
        owner_agent_id: includeAgent ? agentId : null,
        owner_agent_name: "Operations Agent",
        owner_agent_role: "Revenue Operations",
        ownership_status: "ready_to_resume",
        last_owner_change_reason: "approved human review",
        metadata: {},
        created_at: now,
        updated_at: now,
      },
    ],
    agents: includeAgent
      ? [
          {
            id: agentId,
            organization_id: organizationId,
            key: "operations",
            name: "Operations Agent",
            description: "Coordinates controlled execution.",
            config: {
              role: "Revenue Operations",
            },
          },
        ]
      : [],
    executionQueue: [
      {
        id: queueItemId,
        organization_id: organizationId,
        work_item_id: parentWorkItemId,
        review_id: reviewId,
        source_decision_id: null,
        assigned_agent_id: includeAgent ? agentId : null,
        assigned_agent_name: includeAgent ? "Operations Agent" : null,
        status: "completed",
        priority: "high",
        queue_reason: "Approved; continue with operations.",
        failure_reason: null,
        next_action: "Resume operations workflow.",
        metadata: {},
        started_at: now,
        completed_at: now,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews: [
      {
        id: reviewId,
        organization_id: organizationId,
        work_item_id: parentWorkItemId,
        agent_execution_id: null,
        agent_decision_id: null,
        requested_by: "agent-operations",
        reviewer_user_id: null,
        source_agent_id: includeAgent ? agentId : null,
        source_agent_name: "Operations Agent",
        review_type: "approval",
        review_reason: "Approval required.",
        review_title: "Resume Operations",
        review_summary: "Human reviewed the next execution step.",
        review_context: {},
        recommended_action: "Resume operations workflow.",
        status: "approved",
        priority: "high",
        decision: "approve",
        requested_at: now,
        reviewed_at: now,
        reviewed_by: "user-phase-24",
        review_outcome: "Approved",
        review_notes: "Approved; continue.",
        created_at: now,
        updated_at: now,
      },
    ],
    memoryEntries: [],
    aiEvents: [],
    decisions: [],
  };

  function tableRows(table) {
    if (table === "work_items") return state.workItems;
    if (table === "agents") return state.agents;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "human_reviews") return state.humanReviews;
    if (table === "memory_entries") return state.memoryEntries;
    if (table === "ai_events") return state.aiEvents;
    if (table === "agent_decisions") return state.decisions;

    return [];
  }

  function matches(row, filters, inFilters) {
    return (
      Object.entries(filters).every(
        ([key, value]) => row[key] === value
      ) &&
      Object.entries(inFilters).every(([key, values]) =>
        values.includes(row[key])
      )
    );
  }

  function applySortAndLimit(rows, builder) {
    let result = [...rows];

    for (const order of builder.orders) {
      result = result.sort((left, right) => {
        const comparison = String(left[order.key]).localeCompare(
          String(right[order.key])
        );

        return order.ascending ? comparison : -comparison;
      });
    }

    return builder.limitCount === null
      ? result
      : result.slice(0, builder.limitCount);
  }

  function createBuilder(table) {
    const builder = {
      filters: {},
      inFilters: {},
      lessThanFilters: {},
      patch: null,
      insertRow: null,
      updatedRows: null,
      limitCount: null,
      orders: [],
      select() {
        if (this.patch) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(row, this.filters, this.inFilters)
          );
          this.updatedRows.forEach((row) => {
            Object.assign(row, this.patch);

            if (table === "execution_queue" && this.patch.status) {
              transitions.push({
                id: row.id,
                status: this.patch.status,
              });
            }
          });
        }

        return this;
      },
      eq(key, value) {
        this.filters[key] = value;
        return this;
      },
      in(key, values) {
        this.inFilters[key] = values;
        return this;
      },
      lt(key, value) {
        this.lessThanFilters[key] = value;
        return this;
      },
      order(key, options = {}) {
        this.orders.push({
          key,
          ascending: options.ascending !== false,
        });
        return this;
      },
      limit(count) {
        this.limitCount = count;
        return this;
      },
      update(patch) {
        this.patch = patch;
        return this;
      },
      insert(row) {
        const record = {
          id: `${table}-${tableRows(table).length + 1}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        };

        tableRows(table).push(record);
        this.insertRow = record;
        return this;
      },
      async single() {
        if (this.insertRow) {
          return { data: { ...this.insertRow }, error: null };
        }

        const rows = applySortAndLimit(
          this.updatedRows ??
            tableRows(table).filter((candidate) =>
              matches(candidate, this.filters, this.inFilters)
            ),
          this
        );
        const row = rows[0];

        return row
          ? { data: { ...row }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      async maybeSingle() {
        const rows = applySortAndLimit(
          this.updatedRows ??
            tableRows(table).filter((candidate) =>
              matches(candidate, this.filters, this.inFilters)
            ),
          this
        );
        const row = rows[0];

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        if (this.patch && !this.updatedRows) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(row, this.filters, this.inFilters)
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        let rows = tableRows(table)
          .filter((row) =>
            matches(row, this.filters, this.inFilters)
          )
          .filter((row) =>
            Object.entries(this.lessThanFilters).every(
              ([key, value]) => row[key] < value
            )
          );

        rows = applySortAndLimit(rows, this);

        return { data: rows.map((row) => ({ ...row })), error: null };
      },
      then(resolve, reject) {
        return this.execute().then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    organizationId,
    parentWorkItemId,
    queueItemId,
    agentId,
    reviewId,
    state,
    transitions,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const { executeAgentCapability, selectAgentCapability } = loadModule(
  "lib/application/agents/agent-capabilities.ts"
);
const { evaluateContinuationPolicy } = loadModule(
  "lib/application/agents/continuation-policy.ts"
);
const { generateFollowUpWork } = loadModule(
  "lib/application/agents/work-generation.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

async function generatePolicyScenario(label, options = {}) {
  const environment = createFakeSupabase(label, options);
  const runtimeContext = createRuntimeContext({
    organizationId: environment.organizationId,
    queueItemId: environment.queueItemId,
    parentWorkItemId: environment.parentWorkItemId,
    reviewId: environment.reviewId,
    agentId: options.includeAgent === false ? null : environment.agentId,
    reviewStatus: options.reviewStatus ?? "approved",
    continuationDepth: options.continuationDepth ?? 0,
  });
  const selectedCapability = selectAgentCapability(runtimeContext);
  const capabilityResult = executeAgentCapability({
    organizationId: environment.organizationId,
    agentExecutionId: `agent-execution-phase-24-${label}`,
    runtimeContext,
    capability: selectedCapability,
  });
  const result = await generateFollowUpWork({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    parentWorkItemId: environment.parentWorkItemId,
    agentExecutionId: `agent-execution-phase-24-${label}`,
    capabilityId: capabilityResult.capability_id,
    capabilityResult,
    runtimeContext,
    processedAt: new Date().toISOString(),
  });
  const followUpWorkItem = environment.state.workItems.find(
    (item) => item.type === "follow_up"
  );
  const followUpQueueItem = environment.state.executionQueue.find(
    (item) => item.work_item_id === followUpWorkItem?.id
  );

  return {
    environment,
    runtimeContext,
    capabilityResult,
    result,
    followUpWorkItem,
    followUpQueueItem,
  };
}

const safeScenario = await generatePolicyScenario("safe", {
  includeAgent: true,
});
assert(
  safeScenario.result.continuation_policy?.allowed === true,
  "safe internal queue item should be allowed"
);
assert(
  ["manual", "guarded"].includes(
    safeScenario.result.continuation_policy.mode
  ),
  "safe continuation should be manual or guarded"
);
assert(
  safeScenario.result.continuation_policy.risk_level === "low",
  "safe continuation should be low risk"
);

const missingAgentScenario = await generatePolicyScenario(
  "missing-agent",
  {
    includeAgent: false,
  }
);
assert(
  missingAgentScenario.result.continuation_policy?.allowed === false,
  "missing agent should block continuation"
);

const rejectedRuntimeContext = createRuntimeContext({
  organizationId: safeScenario.environment.organizationId,
  queueItemId: safeScenario.environment.queueItemId,
  parentWorkItemId: safeScenario.environment.parentWorkItemId,
  reviewId: safeScenario.environment.reviewId,
  agentId: safeScenario.environment.agentId,
  reviewStatus: "rejected",
});
const rejectedPolicy = evaluateContinuationPolicy({
  organizationId: safeScenario.environment.organizationId,
  queueItem: safeScenario.followUpQueueItem,
  workItem: safeScenario.followUpWorkItem,
  runtimeContext: rejectedRuntimeContext,
  capabilityResult: safeScenario.capabilityResult,
  generatedWork: safeScenario.result,
});
assert(
  rejectedPolicy.allowed === false,
  "rejected human review should block continuation"
);

const highRiskPolicy = evaluateContinuationPolicy({
  organizationId: safeScenario.environment.organizationId,
  queueItem: {
    ...safeScenario.followUpQueueItem,
    metadata: {
      continuation_depth: 1,
    },
  },
  workItem: {
    id: safeScenario.followUpWorkItem.id,
    metadata: {
      risk_level: "high",
    },
  },
  runtimeContext: safeScenario.runtimeContext,
  capabilityResult: safeScenario.capabilityResult,
  generatedWork: safeScenario.result,
});
assert(highRiskPolicy.allowed === false, "high risk should block");

const depthLimitPolicy = evaluateContinuationPolicy({
  organizationId: safeScenario.environment.organizationId,
  queueItem: {
    ...safeScenario.followUpQueueItem,
    metadata: {
      continuation_depth: 4,
    },
  },
  workItem: safeScenario.followUpWorkItem,
  runtimeContext: safeScenario.runtimeContext,
  capabilityResult: safeScenario.capabilityResult,
  generatedWork: safeScenario.result,
});
assert(
  depthLimitPolicy.allowed === false,
  "depth limit should block continuation"
);

const policyDecision = safeScenario.environment.state.decisions.find(
  (decision) =>
    decision.decision_type === "continuation_policy_evaluated"
);
assert(policyDecision, "policy decision should be logged");
assert(
  policyDecision.decision.outcome.allowed === true,
  "policy decision should store allowed"
);
assert(
  Array.isArray(policyDecision.decision.outcome.policy_checks),
  "policy decision should store policy checks"
);
assert(
  safeScenario.followUpQueueItem.metadata.continuation_allowed === true,
  "generated queue item should store policy allowed metadata"
);
assert(
  safeScenario.followUpQueueItem.metadata.continuation_mode === "manual",
  "generated queue item should store policy mode metadata"
);
assert(
  safeScenario.followUpQueueItem.metadata.continuation_depth === 1,
  "generated queue item should store continuation depth"
);

const timeline = await listWorkItemTimeline({
  supabase: safeScenario.environment.supabase,
  workItemId: safeScenario.environment.parentWorkItemId,
  organizationId: safeScenario.environment.organizationId,
});
const policyTimelineItem = timeline.items.find(
  (item) => item.title === "Continuation Policy Evaluated"
);
assert(
  policyTimelineItem?.message ===
    "Continuation is allowed in manual mode with low risk.",
  "timeline should include Continuation Policy Evaluated"
);
assert(
  safeScenario.followUpQueueItem.status === "ready" &&
    !safeScenario.environment.transitions.some(
      (transition) =>
        transition.id === safeScenario.followUpQueueItem.id &&
        transition.status === "in_progress"
    ),
  "generated queue item should not be automatically processed"
);

const sourcePaths = [
  "lib/application/agents/continuation-policy.ts",
  "lib/application/agents/work-generation.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "app/api/execution-queue/process-next/route.ts",
];
const combinedSource = sourcePaths
  .map((relativePath) =>
    fs.readFileSync(path.join(rootDir, relativePath), "utf8")
  )
  .join("\n");

assert(
  !combinedSource.includes("@/lib/ai/openai") &&
    !combinedSource.includes("new OpenAI") &&
    !combinedSource.includes("responses.create") &&
    !combinedSource.includes("chat.completions"),
  "should not call OpenAI"
);
assert(
  !combinedSource.includes("resend") &&
    !combinedSource.includes("sendEmail") &&
    !combinedSource.includes("emails.send"),
  "should not send email"
);
assert(
  !combinedSource.includes("setInterval") &&
    !combinedSource.includes("setTimeout") &&
    !combinedSource.includes("cron") &&
    !combinedSource.includes("while (") &&
    !combinedSource.includes("while("),
  "should not introduce autonomous loop"
);

console.log(
  JSON.stringify(
    {
      continuation_guardrails: {
        safe_mode: safeScenario.result.continuation_policy.mode,
        safe_allowed: safeScenario.result.continuation_policy.allowed,
        missing_agent_allowed:
          missingAgentScenario.result.continuation_policy.allowed,
        rejected_review_allowed:
          rejectedPolicy.allowed,
        high_risk_allowed: highRiskPolicy.allowed,
        depth_limit_allowed: depthLimitPolicy.allowed,
        policy_decision_id: policyDecision.id,
        queue_metadata: {
          continuation_mode:
            safeScenario.followUpQueueItem.metadata.continuation_mode,
          continuation_allowed:
            safeScenario.followUpQueueItem.metadata.continuation_allowed,
          continuation_depth:
            safeScenario.followUpQueueItem.metadata.continuation_depth,
        },
        timeline_title: policyTimelineItem?.title ?? null,
        timeline_message: policyTimelineItem?.message ?? null,
        generated_queue_autonomously_processed: false,
        openai_called: false,
      },
    },
    null,
    2
  )
);
