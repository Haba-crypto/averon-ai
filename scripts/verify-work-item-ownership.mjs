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

function createFakeSupabase() {
  const organizationId = "org-phase-12";
  const workItemId = "work-item-phase-12";
  const state = {
    workItems: [
      {
        id: workItemId,
        organization_id: organizationId,
        owner_type: "unassigned",
        owner_agent_id: null,
        owner_agent_name: null,
        owner_agent_role: null,
        owner_user_id: null,
        ownership_status: "unassigned",
        last_owner_change_at: null,
        last_owner_change_reason: null,
      },
    ],
    decisions: [],
  };

  function findWorkItem(filters) {
    return state.workItems.find((workItem) =>
      Object.entries(filters).every(
        ([key, value]) => workItem[key] === value
      )
    );
  }

  function createBuilder(table) {
    const builder = {
      filters: {},
      patch: null,
      select() {
        return this;
      },
      eq(key, value) {
        this.filters[key] = value;
        return this;
      },
      async single() {
        if (table !== "work_items") {
          return { data: null, error: null };
        }

        const row = findWorkItem(this.filters);

        return row
          ? { data: { ...row }, error: null }
          : { data: null, error: new Error("Not found") };
      },
      update(patch) {
        this.patch = patch;
        return this;
      },
      async insert(row) {
        if (table === "agent_decisions") {
          state.decisions.push({
            id: `decision-${state.decisions.length + 1}`,
            agent_execution_id: null,
            created_at:
              row.metadata?.changed_at ??
              new Date().toISOString(),
            ...row,
          });

          return { data: null, error: null };
        }

        if (table === "work_items") {
          state.workItems.push(row);
          return { data: row, error: null };
        }

        return { data: null, error: null };
      },
    };

    const originalSelect = builder.select;
    builder.select = function select(...args) {
      originalSelect.apply(this, args);

      if (this.patch && table === "work_items") {
        const row = findWorkItem(this.filters);

        if (!row) {
          return this;
        }

        Object.assign(row, this.patch);
      }

      return this;
    };

    return builder;
  }

  return {
    organizationId,
    workItemId,
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

async function updateOwnership(step) {
  const result = await updateWorkItemOwnership({
    supabase,
    workItemId,
    organizationId,
    ...step,
  });
  const insertedDecision = state.decisions.at(-1);
  const timelineItem = normalizeAgentDecisionForVerification({
    id: insertedDecision.id,
    agent_execution_id: null,
    agent_id: insertedDecision.agent_id,
    decision_type: insertedDecision.decision_type,
    decision: insertedDecision.decision,
    rationale: insertedDecision.rationale,
    confidence: insertedDecision.confidence,
    metadata: insertedDecision.metadata,
    created_at: insertedDecision.created_at,
  });

  assert(
    result.workItem.id === workItemId,
    `${step.label} changed work item id`
  );
  assert(
    insertedDecision.decision_type === "ownership_change",
    `${step.label} should create ownership_change decision`
  );
  assert(
    insertedDecision.work_item_id === workItemId,
    `${step.label} decision should preserve work item id`
  );

  return {
    label: step.label,
    owner_type: result.workItem.owner_type,
    owner_agent_name: result.workItem.owner_agent_name,
    ownership_status: result.workItem.ownership_status,
    last_owner_change_reason:
      result.workItem.last_owner_change_reason,
    work_item_id: result.workItem.id,
    decision_type: insertedDecision.decision_type,
    timeline_title: timelineItem.title,
  };
}

const { updateWorkItemOwnership } = loadModule(
  "lib/application/work-items/update-work-item-ownership.ts"
);
const { normalizeAgentDecisionForVerification } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const { supabase, organizationId, workItemId, state } =
  createFakeSupabase();

const agentByName = {
  "SDR Agent": {
    id: "agent-sdr",
    name: "SDR Agent",
    role: "Sales Development",
  },
  "Research Agent": {
    id: "agent-research",
    name: "Research Agent",
    role: "Account Intelligence",
  },
  "Closer Agent": {
    id: "agent-closer",
    name: "Closer Agent",
    role: "Deal Progression",
  },
  "Operations Agent": {
    id: "agent-operations",
    name: "Operations Agent",
    role: "Revenue Operations",
  },
};

const results = [];

results.push(
  await updateOwnership({
    label: "First SDR routing",
    ownerType: "ai",
    ownerAgentId: agentByName["SDR Agent"].id,
    ownerAgentName: agentByName["SDR Agent"].name,
    ownerAgentRole: agentByName["SDR Agent"].role,
    reason: "Initial SDR route selected for qualification.",
    sourceAgent: null,
    targetAgent: agentByName["SDR Agent"],
  })
);

results.push(
  await updateOwnership({
    label: "Research route",
    ownerType: "ai",
    ownerAgentId: agentByName["Research Agent"].id,
    ownerAgentName: agentByName["Research Agent"].name,
    ownerAgentRole: agentByName["Research Agent"].role,
    reason: "Research requirements and integration analysis requested.",
    sourceAgent: agentByName["SDR Agent"],
    targetAgent: agentByName["Research Agent"],
  })
);

results.push(
  await updateOwnership({
    label: "Research to Closer handoff",
    ownerType: "ai",
    ownerAgentId: agentByName["Closer Agent"].id,
    ownerAgentName: agentByName["Closer Agent"].name,
    ownerAgentRole: agentByName["Closer Agent"].role,
    reason: "Buying intent and proposal request detected.",
    sourceAgent: agentByName["Research Agent"],
    targetAgent: agentByName["Closer Agent"],
  })
);

results.push(
  await updateOwnership({
    label: "Closer to Operations handoff",
    ownerType: "ai",
    ownerAgentId: agentByName["Operations Agent"].id,
    ownerAgentName: agentByName["Operations Agent"].name,
    ownerAgentRole: agentByName["Operations Agent"].role,
    reason: "Implementation and launch planning requested.",
    sourceAgent: agentByName["Closer Agent"],
    targetAgent: agentByName["Operations Agent"],
  })
);

results.push(
  await updateOwnership({
    label: "Human Review case",
    ownerType: "human",
    reason: "Approval or legal review required.",
    sourceAgent: agentByName["Operations Agent"],
    targetAgent: "Human Review",
  })
);

const finalWorkItem = state.workItems[0];

assert(
  state.workItems.length === 1,
  "Ownership service should not create duplicate work items"
);
assert(
  finalWorkItem.id === workItemId,
  "Work item id should remain unchanged"
);
assert(
  finalWorkItem.owner_type === "human",
  "Human Review should set owner_type to human"
);
assert(
  finalWorkItem.ownership_status === "human_review",
  "Human Review should set human_review ownership status"
);
assert(
  state.decisions.length === 5,
  "Each ownership change should create one decision record"
);

console.log(
  JSON.stringify(
    {
      work_item_id_unchanged: finalWorkItem.id === workItemId,
      duplicate_work_items_created: state.workItems.length - 1,
      ownership_decisions_created: state.decisions.length,
      steps: results,
      final_owner: {
        owner_type: finalWorkItem.owner_type,
        owner_agent_name: finalWorkItem.owner_agent_name,
        owner_user_id: finalWorkItem.owner_user_id,
        ownership_status: finalWorkItem.ownership_status,
      },
    },
    null,
    2
  )
);
