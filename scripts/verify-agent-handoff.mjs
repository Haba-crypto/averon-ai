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

function verifyHandoffCase({
  label,
  sourceAgent,
  message,
  expectedTarget,
}) {
  const decision = decideAgentHandoff({
    sourceAgent,
    message,
  });
  const workItemId = "work-item-phase-11";
  const executionId = `execution-${label
    .toLowerCase()
    .replaceAll(" ", "-")}`;
  const row = {
    id: `decision-${label.toLowerCase().replaceAll(" ", "-")}`,
    agent_execution_id: executionId,
    agent_id: "agent-id",
    decision_type: "handoff",
    decision: {
      outcome: {
        should_handoff: decision.should_handoff,
        source_agent: sourceAgent,
        target_agent: decision.target_agent,
        reason: decision.reason,
        confidence: decision.confidence,
        work_item_id: workItemId,
        continued_current_execution: true,
      },
    },
    rationale: decision.should_handoff
      ? `${sourceAgent} handed work to ${decision.target_agent}. ${decision.reason}`
      : decision.reason,
    confidence: decision.confidence,
    metadata: {
      should_handoff: decision.should_handoff,
      source_agent: sourceAgent,
      target_agent: decision.target_agent,
      reason: decision.reason,
      confidence: decision.confidence,
      agent_identity: {
        agent_name: sourceAgent,
      },
    },
    created_at: "2026-05-29T00:00:00.000Z",
  };
  const timelineItem = normalizeAgentDecisionForVerification(row);

  assert(
    decision.target_agent === expectedTarget,
    `${label} target ${decision.target_agent}, expected ${expectedTarget}`
  );
  assert(
    decision.should_handoff === Boolean(expectedTarget),
    `${label} should_handoff mismatch`
  );
  assert(
    typeof decision.reason === "string" && decision.reason.length > 0,
    `${label} should expose a handoff reason`
  );
  assert(
    decision.confidence >= 0 && decision.confidence <= 1,
    `${label} confidence should be normalized`
  );
  assert(
    row.decision.outcome.work_item_id === workItemId,
    `${label} should preserve work item id`
  );
  assert(
    row.agent_execution_id === executionId,
    `${label} decision should link to agent execution`
  );
  assert(
    row.decision_type === "handoff",
    `${label} should record handoff decision type`
  );
  assert(
    timelineItem.source === "agent_decisions",
    `${label} timeline should come from agent decisions`
  );
  assert(
    timelineItem.metadata.agent_execution_id === executionId,
    `${label} timeline should preserve execution link`
  );
  assert(
    timelineItem.title.includes(sourceAgent),
    `${label} timeline title should name source agent`
  );

  if (expectedTarget) {
    assert(
      timelineItem.title.includes(expectedTarget),
      `${label} timeline title should name target`
    );
    assert(
      timelineItem.status === "handoff",
      `${label} timeline should mark handoff status`
    );
  } else {
    assert(
      timelineItem.status === "continued",
      `${label} timeline should mark continued status`
    );
  }

  return {
    label,
    source_agent: sourceAgent,
    target_agent: decision.target_agent,
    should_handoff: decision.should_handoff,
    confidence: decision.confidence,
    work_item_id: row.decision.outcome.work_item_id,
    agent_execution_id: row.agent_execution_id,
    timeline_title: timelineItem.title,
    timeline_status: timelineItem.status,
  };
}

const { decideAgentHandoff } = loadModule(
  "lib/application/agents/handoff-decision.ts"
);
const { normalizeAgentDecisionForVerification } = loadModule(
  "lib/application/work-items/list-work-item-timeline.ts"
);

const cases = [
  {
    label: "SDR to Research",
    sourceAgent: "SDR Agent",
    message: "Изучи требования и какие интеграции нужны?",
    expectedTarget: "Research Agent",
  },
  {
    label: "Research to Closer",
    sourceAgent: "Research Agent",
    message: "Требования понятны. Отправьте предложение.",
    expectedTarget: "Closer Agent",
  },
  {
    label: "Closer to Operations",
    sourceAgent: "Closer Agent",
    message: "Начинаем внедрение. Создай план запуска.",
    expectedTarget: "Operations Agent",
  },
  {
    label: "Operations to Human Review",
    sourceAgent: "Operations Agent",
    message: "Нужно согласование. Требуется юридическая проверка.",
    expectedTarget: "Human Review",
  },
  {
    label: "No handoff",
    sourceAgent: "SDR Agent",
    message: "Привет, расскажите коротко о продукте.",
    expectedTarget: null,
  },
];

const results = Object.fromEntries(
  cases.map((testCase) => [
    testCase.label,
    verifyHandoffCase(testCase),
  ])
);

console.log(JSON.stringify(results, null, 2));
