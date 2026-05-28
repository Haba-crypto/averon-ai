import fs from "fs";
import Module from "module";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(
  rootDir,
  "lib",
  "application",
  "memory",
  "memory-retrieval.ts"
);

function loadRetrievalModule() {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText;
  const mod = new Module(sourcePath);

  mod.filename = sourcePath;
  mod.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  mod._compile(compiled, sourcePath);

  return mod.exports;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMemoryRow({
  id,
  leadId = "lead-1",
  workItemId = "work-item-1",
  type,
  content,
  createdAt,
}) {
  return {
    id,
    lead_id: leadId,
    work_item_id: workItemId,
    content,
    metadata: {
      memory_type: type,
    },
    created_at: createdAt,
  };
}

function ids(entries) {
  return entries.map((entry) => entry.id);
}

function main() {
  const {
    formatRelevantMemoryForPrompt,
    rankMemoryRowsForVerification,
  } = loadRetrievalModule();

  const rows = [
    createMemoryRow({
      id: "mem-hubspot",
      type: "fact",
      content: "Uses HubSpot",
      createdAt: "2026-05-29T08:00:00.000Z",
    }),
    createMemoryRow({
      id: "mem-budget",
      type: "objection",
      content: "Budget limited to 20000 euros",
      createdAt: "2026-05-29T09:00:00.000Z",
    }),
  ];

  const crmMemory = rankMemoryRowsForVerification({
    rows,
    leadId: "lead-1",
    workItemId: "work-item-1",
    latestUserMessage: "What CRM do we currently use?",
  });
  const proposalMemory = rankMemoryRowsForVerification({
    rows,
    leadId: "lead-1",
    workItemId: "work-item-1",
    latestUserMessage: "Can you prepare an enterprise package proposal?",
  });
  const noMemory = rankMemoryRowsForVerification({
    rows: [],
    leadId: "lead-1",
    workItemId: "work-item-1",
    latestUserMessage: "Can you help?",
  });

  assert(
    crmMemory.facts.some((entry) => entry.content.includes("HubSpot")),
    "Case 1 should retrieve HubSpot fact memory"
  );
  assert(
    proposalMemory.objections.some((entry) =>
      entry.content.includes("20000 euros")
    ),
    "Case 2 should retrieve budget objection memory"
  );
  assert(
    Object.values(noMemory).every((entries) => entries.length === 0),
    "Case 3 should return empty memory groups"
  );

  console.log(
    JSON.stringify(
      {
        case1: {
          query: "What CRM do we currently use?",
          factIds: ids(crmMemory.facts),
          promptContext: formatRelevantMemoryForPrompt(crmMemory),
        },
        case2: {
          query: "Can you prepare an enterprise package proposal?",
          objectionIds: ids(proposalMemory.objections),
          promptContext: formatRelevantMemoryForPrompt(proposalMemory),
        },
        case3: {
          query: "Can you help?",
          memoryCount: Object.values(noMemory).flat().length,
          promptContext: formatRelevantMemoryForPrompt(noMemory),
        },
      },
      null,
      2
    )
  );
}

main();
