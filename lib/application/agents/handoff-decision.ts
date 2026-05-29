import type { RevenueAgent } from "@/lib/ai/agents/revenue-router";

export type HandoffTarget = RevenueAgent | "Human Review";

export type HandoffDecision = {
  should_handoff: boolean;
  target_agent: HandoffTarget | null;
  reason: string;
  confidence: number;
};

type HandoffRule = {
  sourceAgent: RevenueAgent;
  targetAgent: HandoffTarget;
  reason: string;
  patterns: RegExp[];
  confidence: number;
};

const NO_HANDOFF_CONFIDENCE = 0.25;

const HANDOFF_RULES: HandoffRule[] = [
  {
    sourceAgent: "SDR Agent",
    targetAgent: "Research Agent",
    reason:
      "Requirements, integration, or technical discovery analysis is needed before sales progression.",
    confidence: 0.82,
    patterns: [
      /изучи/i,
      /требован/i,
      /какие\s+интеграции\s+нужны/i,
      /интеграц/i,
      /проанализируй/i,
      /анализ/i,
      /процесс/i,
      /\brequirements?\b/i,
      /\bintegrations?\b/i,
      /\btechnical\s+discovery\b/i,
      /\banaly[sz]e\b/i,
      /\banalysis\b/i,
      /\bprocess\b/i,
    ],
  },
  {
    sourceAgent: "Research Agent",
    targetAgent: "Closer Agent",
    reason:
      "Requirements are understood and the conversation shows buying intent or asks for a proposal.",
    confidence: 0.84,
    patterns: [
      /отправьте\s+предложение/i,
      /предложени/i,
      /готовы\s+обсуждать\s+контракт/i,
      /контракт/i,
      /договор/i,
      /готовы\s+покупать/i,
      /\bsend\s+(a\s+)?proposal\b/i,
      /\bproposal\b/i,
      /\bready\s+to\s+(discuss|buy|move)\b/i,
      /\bcontract\b/i,
      /\bbuying\s+intent\b/i,
    ],
  },
  {
    sourceAgent: "Closer Agent",
    targetAgent: "Operations Agent",
    reason:
      "A next step has been agreed and implementation, launch, or onboarding work is requested.",
    confidence: 0.86,
    patterns: [
      /начинаем\s+внедрение/i,
      /внедрени/i,
      /создай\s+план\s+запуска/i,
      /план\s+запуска/i,
      /онбординг/i,
      /следующий\s+шаг/i,
      /\bstart\s+implementation\b/i,
      /\bimplementation\b/i,
      /\bonboarding\b/i,
      /\blaunch\s+plan\b/i,
      /\bnext\s+step\s+(agreed|confirmed)\b/i,
    ],
  },
  {
    sourceAgent: "Operations Agent",
    targetAgent: "Human Review",
    reason:
      "Approval, exception handling, or legal/contract review is required before execution continues.",
    confidence: 0.88,
    patterns: [
      /нужно\s+согласование/i,
      /согласован/i,
      /требуется\s+юридическая\s+проверка/i,
      /юридическ/i,
      /проверка\s+договора/i,
      /закупк/i,
      /исключени/i,
      /\bapproval\b/i,
      /\bapproval\s+from\b/i,
      /\bapproval\s+required\b/i,
      /\bneeds?\s+approval\b/i,
      /\bprocurement\b/i,
      /\blegal\b/i,
      /\bexception\b/i,
      /\blegal\s+review\b/i,
      /\bcontract\s+review\b/i,
      /\bcompliance\b/i,
    ],
  },
];

export function decideAgentHandoff({
  sourceAgent,
  message,
}: {
  sourceAgent: string | null | undefined;
  message: string;
}): HandoffDecision {
  const normalizedSourceAgent = normalizeRevenueAgent(sourceAgent);
  const normalizedMessage = message.trim();

  if (!normalizedSourceAgent || !normalizedMessage) {
    return buildNoHandoffDecision(normalizedSourceAgent);
  }

  const rule = HANDOFF_RULES.find(
    (candidate) =>
      candidate.sourceAgent === normalizedSourceAgent &&
      candidate.patterns.some((pattern) =>
        pattern.test(normalizedMessage)
      )
  );

  if (!rule) {
    return buildNoHandoffDecision(normalizedSourceAgent);
  }

  return {
    should_handoff: true,
    target_agent: rule.targetAgent,
    reason: rule.reason,
    confidence: rule.confidence,
  };
}

export function isAgentHandoffTarget(targetAgent: HandoffTarget | null) {
  return targetAgent !== null && targetAgent !== "Human Review";
}

function normalizeRevenueAgent(
  sourceAgent: string | null | undefined
): RevenueAgent | null {
  if (
    sourceAgent === "SDR Agent" ||
    sourceAgent === "Research Agent" ||
    sourceAgent === "Closer Agent" ||
    sourceAgent === "Operations Agent"
  ) {
    return sourceAgent;
  }

  return null;
}

function buildNoHandoffDecision(
  sourceAgent: RevenueAgent | null
): HandoffDecision {
  return {
    should_handoff: false,
    target_agent: null,
    reason: sourceAgent
      ? `No handoff rule matched for ${sourceAgent}; current agent continues.`
      : "No handoff source agent could be resolved; current execution continues.",
    confidence: NO_HANDOFF_CONFIDENCE,
  };
}
