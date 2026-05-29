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
  const organizationId = `org-phase-31-${label}`;
  const leadId = `lead-phase-31-${label}`;
  const agentId = `agent-phase-31-${label}`;
  const workItemId = `work-item-phase-31-${label}`;
  const queueItemId = `queue-phase-31-${label}`;
  const reviewId = `review-phase-31-${label}`;
  const now = new Date().toISOString();
  const agentName = options.agentName ?? "Operations Agent";
  const reviewStatus = options.reviewStatus ?? "approved";
  const reviewOutcome =
    reviewStatus === "rejected" ? "Rejected" : "Approved";
  const state = {
    leads: [
      {
        id: leadId,
        organization_id: organizationId,
        name: "Ada Buyer",
        email: "ada@example.com",
        status: options.leadStatus ?? "qualified",
        intent_score: 84,
        urgency: "medium",
      },
    ],
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        title: `${agentName} reasoning work`,
        type: options.workType ?? "lead_acquisition",
        status: "queued",
        source_type: "lead",
        source_id: leadId,
        lead_id: leadId,
        owner_type: "ai",
        owner_agent_id: agentId,
        owner_agent_name: agentName,
        owner_agent_role: options.agentRole ?? "Revenue Operations",
        ownership_status: "ready_to_resume",
        last_owner_change_reason:
          options.ownerReason ?? "approved human review; ready to resume",
        metadata: {
          risk_level: options.riskLevel ?? "low",
        },
        updated_at: now,
        created_at: now,
      },
    ],
    agents: [
      {
        id: agentId,
        organization_id: organizationId,
        key: agentName.toLowerCase().replaceAll(" ", "_"),
        name: agentName,
        description: `${agentName} deterministic test agent.`,
        config: {
          role: options.agentRole ?? "Revenue Operations",
        },
      },
    ],
    executionQueue: [
      {
        id: queueItemId,
        organization_id: organizationId,
        work_item_id: workItemId,
        review_id: options.missingReview ? null : reviewId,
        source_decision_id: `resume-decision-phase-31-${label}`,
        assigned_agent_id: agentId,
        assigned_agent_name: agentName,
        status: "ready",
        priority: "high",
        queue_reason:
          options.queueReason ?? "Approved; continue with operations.",
        failure_reason: null,
        next_action: options.nextAction ?? "Resume operations workflow.",
        metadata: {},
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    humanReviews: options.missingReview
      ? []
      : [
          {
            id: reviewId,
            organization_id: organizationId,
            work_item_id: workItemId,
            agent_execution_id: `execution-before-phase-31-${label}`,
            agent_decision_id: null,
            requested_by: "agent-test",
            reviewer_user_id: null,
            source_agent_id: agentId,
            source_agent_name: agentName,
            review_type: "approval",
            review_reason: "Approval required.",
            review_title: "Resume Work",
            review_summary: "Human reviewed the next execution step.",
            review_context: {},
            recommended_action:
              options.nextAction ?? "Resume operations workflow.",
            status: reviewStatus,
            priority: "high",
            decision: reviewStatus === "rejected" ? "reject" : "approve",
            requested_at: now,
            reviewed_at: now,
            reviewed_by: "user-phase-31",
            review_outcome: reviewOutcome,
            review_notes: `${reviewOutcome}; continue.`,
            created_at: now,
            updated_at: now,
          },
        ],
    memoryEntries: [
      {
        id: `memory-phase-31-${label}`,
        organization_id: organizationId,
        agent_id: agentId,
        lead_id: leadId,
        work_item_id: workItemId,
        source_agent_execution_id: null,
        scope: "work_item",
        key: options.memoryKey ?? "approval_context",
        content: options.memoryContent ?? "Human approved resumed execution.",
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
const { selectAgentCapability, executeAgentCapability } = loadModule(
  "lib/application/agents/agent-capabilities.ts"
);
const { buildAgentExecutionPlan } = loadModule(
  "lib/application/agents/agent-planning.ts"
);
const { evaluatePolicyGovernance } = loadModule(
  "lib/application/agents/policy-governance.ts"
);
const { evaluateExecutionOutcome } = loadModule(
  "lib/application/agents/outcome-evaluation.ts"
);
const {
  generateReasoningProposal,
  evaluateReasoningProposal,
} = loadModule("lib/application/agents/reasoning-proposal.ts");
const { processNextExecutionQueueItem } = loadModule(
  "lib/application/execution-queue/process-next-execution-queue-item.ts"
);
const { listWorkItemTimeline } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

async function buildProposal(label, options = {}) {
  const environment = createFakeSupabase(label, options);
  const runtimeContext = await buildAgentRuntimeContext({
    supabase: environment.supabase,
    organizationId: environment.organizationId,
    queueItemId: environment.queueItemId,
    workItemId: environment.workItemId,
    assignedAgentName: options.agentName ?? "Operations Agent",
  });
  const selectedCapability = selectAgentCapability(runtimeContext);
  const capabilityResult = executeAgentCapability({
    organizationId: environment.organizationId,
    agentExecutionId: `execution-phase-31-${label}`,
    runtimeContext,
    capability: selectedCapability,
  });
  const executionPlan = buildAgentExecutionPlan({
    runtimeContext,
    selectedCapability,
    capabilityResult,
    continuationPolicy: {
      allowed: true,
      mode: "manual",
      reason: "Manual continuation only.",
      risk_level: options.riskLevel ?? "low",
      requires_human_review: false,
      max_steps_allowed: 1,
      policy_checks: [],
    },
  });
  const governanceResult = evaluatePolicyGovernance({
    organizationId: environment.organizationId,
    runtimeContext,
    selectedCapability,
    executionPlan,
  });
  const outcomeEvaluation = evaluateExecutionOutcome({
    organizationId: environment.organizationId,
    agentExecution: {
      id: `execution-phase-31-${label}`,
      status: "succeeded",
    },
    runtimeContext,
    capabilityResult,
    sideEffectsResult: {
      created_tasks: [],
      created_work_items: [],
      created_decisions: [],
      created_memory_entries: [],
      updated_work_item: false,
      skipped_duplicates: [],
    },
    planTranslationResult: {
      created_tasks: [],
      created_work_items: [],
      created_queue_items: [],
      skipped_steps: [],
      skipped_duplicates: [],
    },
    workGenerationResult: {
      created_work_items: [],
      created_queue_items: [],
      skipped_duplicates: [],
      continuation_policy: null,
    },
    continuationPolicy: null,
    queueItem: {
      id: environment.queueItemId,
      status: "completed",
    },
  });
  const beforeState = JSON.stringify({
    tasks: environment.state.tasks,
    workItems: environment.state.workItems,
    executionQueue: environment.state.executionQueue,
    agentExecutions: environment.state.agentExecutions,
    decisions: environment.state.decisions,
  });
  const proposal = await generateReasoningProposal({
    runtimeContext,
    governanceResult,
    priorityResult: {
      priority_score: 82,
      urgency_score: 80,
      business_impact_score: 75,
      risk_score: 12,
      scheduling_bucket: "now",
      recommended_execution_order: 1,
      rationale: "Priority fixture.",
      signals: [],
    },
    outcomeEvaluation,
    executionPlan,
  });
  const afterState = JSON.stringify({
    tasks: environment.state.tasks,
    workItems: environment.state.workItems,
    executionQueue: environment.state.executionQueue,
    agentExecutions: environment.state.agentExecutions,
    decisions: environment.state.decisions,
  });

  assert(beforeState === afterState, `${label} proposal has no side effects`);

  return {
    environment,
    runtimeContext,
    governanceResult,
    proposal,
    proposalGovernance: evaluateReasoningProposal({
      proposal,
      governanceResult,
    }),
  };
}

const operations = await buildProposal("operations");
assert(
  operations.proposal.proposed_actions.includes("continue execution"),
  "Operations proposal generated"
);

const sdr = await buildProposal("sdr", {
  agentName: "SDR Agent",
  workType: "lead_qualification",
  queueReason: "Qualify lead and identify missing qualification data.",
  nextAction: "Recommend next qualification question.",
});
assert(
  sdr.proposal.proposed_actions.includes("qualify lead") &&
    sdr.proposal.proposed_actions.includes("recommend next question"),
  "SDR proposal generated"
);

const research = await buildProposal("research", {
  agentName: "Research Agent",
  workType: "account_research",
  queueReason: "Research missing requirements and account context.",
  nextAction: "Identify missing information.",
  memoryKey: "research_gap",
  memoryContent: "Industry and budget are unknown.",
});
assert(
  research.proposal.proposed_actions.includes("identify information gaps") &&
    research.proposal.proposed_actions.includes("propose research areas"),
  "Research proposal generated"
);

const closer = await buildProposal("closer", {
  agentName: "Closer Agent",
  workType: "proposal",
  queueReason: "Prepare proposal next step and check objections.",
  nextAction: "Confirm proposal scope.",
  memoryKey: "deal_risk",
  memoryContent: "Budget objection remains unresolved.",
});
assert(
  closer.proposal.proposed_actions.includes("identify objections") &&
    closer.proposal.proposed_actions.includes("recommend next proposal step"),
  "Closer proposal generated"
);

const unsafeGovernance = evaluateReasoningProposal({
  proposal: {
    ...operations.proposal,
    proposed_actions: [
      "continue execution",
      "send email to customer",
      "call OpenAI",
      "create work item",
    ],
  },
  governanceResult: operations.governanceResult,
});
assert(
  unsafeGovernance.accepted_actions.includes("continue execution") &&
    unsafeGovernance.rejected_actions.includes("send email to customer") &&
    unsafeGovernance.rejected_actions.includes("call OpenAI") &&
    unsafeGovernance.rejected_actions.includes("create work item"),
  "Governance filters unsafe actions"
);

const environment = createFakeSupabase("processing");
const result = await processNextExecutionQueueItem({
  supabase: environment.supabase,
  organizationId: environment.organizationId,
  queueItemId: environment.queueItemId,
});
const agentExecution = environment.state.agentExecutions[0];
const proposalDecision = environment.state.decisions.find(
  (decision) => decision.decision_type === "reasoning_proposal_created"
);
const timeline = await listWorkItemTimeline({
  supabase: environment.supabase,
  workItemId: environment.workItemId,
  organizationId: environment.organizationId,
});
const proposalTimelineItem = timeline.items.find(
  (item) => item.title === "Reasoning Proposal Created"
);

assert(result.success === true, "queue processing fixture succeeds");
assert(
  Boolean(proposalDecision?.decision?.outcome?.proposal_id),
  "reasoning_proposal_created decision created"
);
assert(
  Boolean(agentExecution?.output?.reasoning_proposal?.proposal_id),
  "proposal stored in execution output"
);
assert(
  proposalTimelineItem?.message?.startsWith("Reasoning proposal"),
  "timeline includes reasoning proposal"
);
assert(
  !("created_queue_item_ids" in proposalDecision.decision.outcome) &&
    !("created_work_item_ids" in proposalDecision.decision.outcome) &&
    !("created_task_ids" in proposalDecision.decision.outcome),
  "reasoning proposal decision creates no work"
);

const sourcePaths = [
  "lib/application/agents/reasoning-proposal.ts",
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
assert(
  !combinedSource.includes("sendEmail") &&
    !combinedSource.includes("resend.emails.send"),
  "should not send emails"
);
const reasoningSource = fs.readFileSync(
  path.join(rootDir, "lib/application/agents/reasoning-proposal.ts"),
  "utf8"
);
assert(
  !reasoningSource.includes("execution_queue") &&
    !reasoningSource.includes("processNextExecutionQueueItem") &&
    !reasoningSource.includes("applyCapabilitySideEffects") &&
    !reasoningSource.includes("generateFollowUpWork") &&
    !reasoningSource.includes("translateExecutionPlanToWork"),
  "reasoning layer should not process queue or execute capabilities"
);

console.log(
  JSON.stringify(
    {
      reasoning_proposal: {
        operations_actions: operations.proposal.proposed_actions,
        sdr_actions: sdr.proposal.proposed_actions,
        research_actions: research.proposal.proposed_actions,
        closer_actions: closer.proposal.proposed_actions,
        unsafe_rejected_actions: unsafeGovernance.rejected_actions,
        decision_type: proposalDecision?.decision_type ?? null,
        output_proposal_id:
          agentExecution?.output?.reasoning_proposal?.proposal_id ?? null,
        timeline_title: proposalTimelineItem?.title ?? null,
        timeline_message: proposalTimelineItem?.message ?? null,
        openai_called: false,
        side_effects: false,
        work_created_by_reasoning: false,
        autonomous_loop: false,
      },
    },
    null,
    2
  )
);
