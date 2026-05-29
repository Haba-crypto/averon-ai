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

function createFakeSupabase(label, options = {}) {
  const organizationId = `org-phase-30-${label}`;
  const leadId = `lead-phase-30-${label}`;
  const agentId = `agent-phase-30-${label}`;
  const workItemId = `work-item-phase-30-${label}`;
  const queueItemId = `queue-phase-30-${label}`;
  const reviewId = `review-phase-30-${label}`;
  const now = new Date().toISOString();
  const assignedAgentId =
    options.missingAssignedAgent === true ? null : agentId;
  const assignedAgentName =
    options.missingAssignedAgent === true ? null : "Operations Agent";
  const reviewStatus = options.reviewStatus ?? "approved";
  const reviewOutcome =
    reviewStatus === "rejected" ? "Rejected" : "Approved";
  const reviewIdForQueue =
    options.missingReview === true ? null : reviewId;
  const queueMetadata = options.queueMetadata ?? {};
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Buyer",
        email: "ada@example.com",
        status: "qualified",
        intent_score: 84,
        urgency: "medium",
      },
    ],
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        title: "Governed internal work",
        type: options.workType ?? "lead_acquisition",
        status: "queued",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: "Operations Agent",
        owner_agent_role: "Revenue Operations",
        ownership_status: options.ownershipStatus ?? "ready_to_resume",
        last_owner_change_reason:
          options.ownerReason ?? "approved human review; ready to resume",
        metadata: {},
        updated_at: now,
        created_at: now,
      },
    ],
    agents: [
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
    ],
    executionQueue: [
      {
        id: queueItemId,
        organization_id: organizationId,
        work_item_id: workItemId,
        review_id: reviewIdForQueue,
        source_decision_id: `resume-decision-phase-30-${label}`,
        assigned_agent_id: assignedAgentId,
        assigned_agent_name: assignedAgentName,
        status: "ready",
        priority: options.priority ?? "high",
        queue_reason:
          options.queueReason ?? "Approved; continue with operations.",
        failure_reason: null,
        next_action: options.nextAction ?? "Resume operations workflow.",
        metadata: queueMetadata,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews:
      options.missingReview === true
        ? []
        : [
            {
              id: reviewId,
              organization_id: organizationId,
              work_item_id: workItemId,
              agent_execution_id: `execution-before-phase-30-${label}`,
              agent_decision_id: null,
              requested_by: "agent-operations",
              reviewer_user_id: null,
              source_agent_id: agentId,
              source_agent_name: "Operations Agent",
              review_type: "approval",
              review_reason: "Approval required.",
              review_title: "Resume Operations",
              review_summary: "Human reviewed the next execution step.",
              review_context: {},
              recommended_action: "Resume operations workflow.",
              status: reviewStatus,
              priority: "high",
              decision: reviewStatus === "rejected" ? "reject" : "approve",
              requested_at: now,
              reviewed_at: options.reviewedAt ?? now,
              reviewed_by: "user-phase-30",
              review_outcome: reviewOutcome,
              review_notes: `${reviewOutcome}; continue.`,
              created_at: now,
              updated_at: now,
            },
          ],
    memoryEntries: [
      {
        id: `memory-phase-30-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: "approval_context",
        content: "Human approved resumed execution.",
        metadata: {
          memory_type: "decision",
        },
        expires_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    aiEvents: [],
    tasks: [],
    agentExecutions: [],
    decisions: [],
  };

  function tableRows(table) {
    if (table === "leads") return state.leads;
    if (table === "work_items") return state.workItems;
    if (table === "agents") return state.agents;
    if (table === "execution_queue") return state.executionQueue;
    if (table === "human_reviews") return state.humanReviews;
    if (table === "memory_entries") return state.memoryEntries;
    if (table === "ai_events") return state.aiEvents;
    if (table === "tasks") return state.tasks;
    if (table === "agent_executions") return state.agentExecutions;
    if (table === "agent_decisions") return state.decisions;

    return [];
  }

  function matches(row, filters, inFilters, lessThanFilters) {
    return (
      Object.entries(filters).every(
        ([key, value]) => row[key] === value
      ) &&
      Object.entries(inFilters).every(([key, values]) =>
        values.includes(row[key])
      ) &&
      Object.entries(lessThanFilters).every(
        ([key, value]) => row[key] < value
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
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
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
      or() {
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
              matches(
                candidate,
                this.filters,
                this.inFilters,
                this.lessThanFilters
              )
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
              matches(
                candidate,
                this.filters,
                this.inFilters,
                this.lessThanFilters
              )
            ),
          this
        );
        const row = rows[0];

        return { data: row ? { ...row } : null, error: null };
      },
      async execute() {
        if (this.patch && !this.updatedRows) {
          this.updatedRows = tableRows(table).filter((row) =>
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          );
          this.updatedRows.forEach((row) => Object.assign(row, this.patch));
        }

        const rows = applySortAndLimit(
          tableRows(table).filter((row) =>
            matches(
              row,
              this.filters,
              this.inFilters,
              this.lessThanFilters
            )
          ),
          this
        );

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
    workItemId,
    queueItemId,
    agentId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

const { buildAgentRuntimeContext } = loadModule(
  "lib/application/agents/build-agent-runtime-context.ts"
);
const { selectAgentCapability } = loadModule(
  "lib/application/agents/agent-capabilities.ts"
);
const { evaluatePolicyGovernance } = loadModule(
  "lib/application/agents/policy-governance.ts"
);
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

async function buildGovernance(label, options = {}) {
  const environment = createFakeSupabase(label, options);
  const runtimeContext = await buildAgentRuntimeContext({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    queueItemId: environment.queueItemId,
    workItemId: environment.workItemId,
    assignedAgentName: "Operations Agent",
  });
  const selectedCapability = selectAgentCapability(runtimeContext);
  const governance = evaluatePolicyGovernance({
    organizationId: environment.organizationId,
    runtimeContext,
    selectedCapability,
  });

  return {
    environment,
    runtimeContext,
    selectedCapability,
    governance,
  };
}

const safe = await buildGovernance("safe");
assert(safe.governance.allowed === true, "safe approved work is allowed");
assert(
  safe.governance.autonomy_level === "assisted",
  "safe approved work is assisted"
);

const missingAgent = await buildGovernance("missing-agent", {
  missingAssignedAgent: true,
});
assert(
  missingAgent.governance.blocked === true,
  "missing assigned agent is blocked"
);
assert(
  missingAgent.governance.policy_checks.some(
    (item) => item.check === "assigned_agent_present" && !item.passed
  ),
  "missing agent check is recorded"
);

const rejected = await buildGovernance("rejected", {
  reviewStatus: "rejected",
});
assert(rejected.governance.blocked === true, "rejected review is blocked");

const legal = await buildGovernance("legal", {
  missingReview: true,
  queueReason: "Legal and compliance review needed before continuing.",
  nextAction: "Prepare internal legal compliance notes.",
});
assert(
  legal.governance.human_review_required === true,
  "legal/compliance signal requires human review"
);

const highRisk = await buildGovernance("high-risk", {
  missingReview: true,
  queueMetadata: {
    risk_level: "high",
  },
  queueReason: "Internal high risk approval work.",
});
assert(
  highRisk.governance.blocked === true &&
    highRisk.governance.human_review_required === true,
  "high risk without review is blocked and requires review"
);

const blockedEnvironment = createFakeSupabase("blocked-processing", {
  missingAssignedAgent: true,
});
const blockedResult = await processNextExecutionQueueItem({
  supabase: blockedEnvironment.supabase,
  organizationId: blockedEnvironment.organizationId,
  queueItemId: blockedEnvironment.queueItemId,
});
const blockedDecision = blockedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "policy_governance_evaluated"
);
const blockedCapabilityDecision = blockedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "capability_executed"
);
assert(
  blockedDecision?.decision?.outcome?.blocked === true,
  "governance decision is created"
);
assert(
  blockedEnvironment.state.executionQueue[0].status === "failed",
  "blocked queue item is marked failed"
);
assert(
  blockedResult.result === "policy_blocked" && !blockedCapabilityDecision,
  "blocked queue item does not execute capability"
);
assert(
  blockedEnvironment.state.agentExecutions[0]?.output?.capability_executed ===
    false,
  "blocked agent_execution records safe blocked output"
);

const allowedEnvironment = createFakeSupabase("allowed-processing");
const allowedResult = await processNextExecutionQueueItem({
  supabase: allowedEnvironment.supabase,
  organizationId: allowedEnvironment.organizationId,
  queueItemId: allowedEnvironment.queueItemId,
});
const allowedGovernanceDecision = allowedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "policy_governance_evaluated"
);
const allowedCapabilityDecision = allowedEnvironment.state.decisions.find(
  (decision) => decision.decision_type === "capability_executed"
);
const allowedTimeline = await listWorkItemTimeline({
  supabase: allowedEnvironment.supabase,
  workItemId: allowedEnvironment.workItemId,
  organizationId: allowedEnvironment.organizationId,
});
const governanceTimelineItem = allowedTimeline.items.find(
  (item) => item.title === "Policy Governance Evaluated"
);

assert(allowedResult.success === true, "allowed queue item succeeds");
assert(
  allowedEnvironment.state.executionQueue[0].status === "completed",
  "allowed queue item completes"
);
assert(
  allowedGovernanceDecision?.decision?.outcome?.allowed === true,
  "allowed governance decision is stored"
);
assert(
  Boolean(allowedCapabilityDecision),
  "allowed queue item still executes existing pipeline"
);
assert(
  allowedEnvironment.state.agentExecutions[0]?.output?.policy_governance
    ?.allowed === true,
  "allowed agent_execution stores governance output"
);
assert(
  governanceTimelineItem?.message?.startsWith(
    "Policy Governance Evaluated:"
  ),
  "timeline includes Policy Governance Evaluated"
);
assert(allowedResult.openai_called === false, "processing reports no OpenAI call");

const sourcePaths = [
  "lib/application/agents/policy-governance.ts",
  "lib/application/execution-queue/process-next-execution-queue-item.ts",
  "lib/application/work-items/list-work-item-timeline.ts",
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
      policy_governance: {
        safe_allowed: safe.governance.allowed,
        safe_autonomy_level: safe.governance.autonomy_level,
        missing_agent_blocked: missingAgent.governance.blocked,
        rejected_review_blocked: rejected.governance.blocked,
        legal_requires_review: legal.governance.human_review_required,
        high_risk_blocked: highRisk.governance.blocked,
        decision_type: blockedDecision?.decision_type ?? null,
        blocked_result: blockedResult.result,
        allowed_result: allowedResult.result,
        timeline_title: governanceTimelineItem?.title ?? null,
        openai_called: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
