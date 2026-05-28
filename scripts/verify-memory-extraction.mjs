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
  "conversation-memory-extraction.ts"
);

function loadExtractorModule() {
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

function getTypes(candidates) {
  return candidates.map((candidate) => candidate.type);
}

function extractForMessage(extractConversationMemory, message) {
  return extractConversationMemory({
    lead: null,
    conversationMessages: [{ role: "user", content: message }],
    latestAiResponse: "Thanks, noted.",
  });
}

function createSupabaseStub() {
  const rows = [];
  const keys = new Set();

  return {
    rows,
    client: {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          in(_column, lookupKeys) {
            return Promise.resolve({
              data: lookupKeys
                .filter((key) => keys.has(key))
                .map((key) => ({ key })),
              error: null,
            });
          },
          insert(entries) {
            for (const entry of entries) {
              if (keys.has(entry.key)) {
                return Promise.resolve({ error: { code: "23505" } });
              }

              keys.add(entry.key);
              rows.push(entry);
            }

            return Promise.resolve({ error: null });
          },
        };

        return builder;
      },
    },
  };
}

function formatCandidate(candidate) {
  return {
    type: candidate.type,
    content: candidate.content,
    detectedLanguage: candidate.detectedLanguage,
    patternMatched: candidate.patternMatched,
    sourceMessageExcerpt: candidate.sourceMessageExcerpt,
    confidence: candidate.confidence,
  };
}

async function main() {
  const {
    extractConversationMemory,
    extractAndStoreConversationMemory,
  } = loadExtractorModule();

  const ruMessage =
    "Мы используем HubSpot. Нам нужна интеграция с Salesforce. Бюджет ограничен до 20000 евро.";
  const enMessage =
    "We use HubSpot. We need Salesforce integration. Budget is limited to 20000 euros.";

  const ruCandidates = extractForMessage(
    extractConversationMemory,
    ruMessage
  );
  const enCandidates = extractForMessage(
    extractConversationMemory,
    enMessage
  );

  assert(
    getTypes(ruCandidates).join(",") === "fact,preference,objection",
    `Russian multi-signal types mismatch: ${getTypes(ruCandidates).join(",")}`
  );
  assert(
    getTypes(enCandidates).join(",") === "fact,preference,objection",
    `English multi-signal types mismatch: ${getTypes(enCandidates).join(",")}`
  );

  const store = createSupabaseStub();
  const storeInput = {
    supabase: store.client,
    organizationId: "00000000-0000-0000-0000-000000000001",
    leadId: "00000000-0000-0000-0000-000000000002",
    workItemId: null,
    sourceAgentExecutionId: null,
    lead: null,
    conversationMessages: [{ role: "user", content: enMessage }],
    latestAiResponse: "Thanks, noted.",
  };

  const firstInsert = await extractAndStoreConversationMemory(storeInput);
  const secondInsert = await extractAndStoreConversationMemory(storeInput);

  assert(firstInsert.insertedCount === 3, "First insert should add 3 rows");
  assert(secondInsert.insertedCount === 0, "Duplicate insert should add 0 rows");
  assert(store.rows.length === 3, "Stored row count should stay at 3");

  console.log(
    JSON.stringify(
      {
        russian: ruCandidates.map(formatCandidate),
        english: enCandidates.map(formatCandidate),
        duplicateCheck: {
          firstInserted: firstInsert.insertedCount,
          secondInserted: secondInsert.insertedCount,
          storedRows: store.rows.length,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
