export type RevenueAgent =
  | "SDR Agent"
  | "Closer Agent"
  | "Research Agent"
  | "Operations Agent";

export type RevenueRoutingDecision = {
  selectedAgent: RevenueAgent;
  selected_agent: RevenueAgent;
  scores: Record<RevenueAgent, number>;
  matchedSignals: Record<RevenueAgent, string[]>;
  matched_signals: Record<RevenueAgent, string[]>;
  rationale: string;
  confidence: number;
};

type RoutingRule = {
  signal: string;
  patterns: RegExp[];
  weight?: number;
};

const AGENTS: RevenueAgent[] = [
  "SDR Agent",
  "Research Agent",
  "Closer Agent",
  "Operations Agent",
];

const UNCERTAIN_CONFIDENCE = 0.3;

const ROUTING_RULES: Record<RevenueAgent, RoutingRule[]> = {
  "SDR Agent": [
    {
      signal: "pricing interest",
      patterns: [
        /сколько\s+стоит/i,
        /стоимость/i,
        /цена/i,
        /прайс/i,
        /\bhow\s+much\s+does\s+it\s+cost\b/i,
        /\bpricing\b/i,
        /\bprice\b/i,
        /\bcost\b/i,
      ],
      weight: 2,
    },
    {
      signal: "demo interest",
      patterns: [
        /хочу\s+демо/i,
        /демо/i,
        /\bbook\s+a\s+demo\b/i,
        /\bdemo\b/i,
      ],
      weight: 2,
    },
    {
      signal: "initial qualification",
      patterns: [
        /подходит\s+ли/i,
        /квалификац/i,
        /\bqualify\b/i,
        /\bqualification\b/i,
        /\bfit\b/i,
      ],
    },
    {
      signal: "buying curiosity",
      patterns: [
        /интересует/i,
        /интересно/i,
        /\binterested\b/i,
        /\bcurious\b/i,
        /\blooking\s+at\b/i,
      ],
    },
    {
      signal: "product questions",
      patterns: [
        /расскажите\s+про\s+продукт/i,
        /как\s+работает/i,
        /что\s+умеет/i,
        /\bproduct\b/i,
        /\bhow\s+does\s+it\s+work\b/i,
      ],
    },
    {
      signal: "implementation interest",
      patterns: [
        /интересует\s+внедрение/i,
        /внедрени/i,
        /\bimplementation\b/i,
        /\bimplement\b/i,
        /\brollout\b/i,
      ],
    },
  ],
  "Research Agent": [
    {
      signal: "research",
      patterns: [/изучи/i, /исслед/i, /\bresearch\b/i],
      weight: 2,
    },
    {
      signal: "analysis",
      patterns: [/проанализируй/i, /анализ/i, /\banalyze\b/i, /\banalysis\b/i],
      weight: 2,
    },
    {
      signal: "comparison",
      patterns: [/сравни/i, /сравнение/i, /\bcompare\b/i, /\bcomparison\b/i],
      weight: 2,
    },
    {
      signal: "requirements discovery",
      patterns: [/требован/i, /\brequirements?\b/i],
      weight: 2,
    },
    {
      signal: "integration details",
      patterns: [
        /какие\s+интеграции\s+нужны/i,
        /детал[иия].{0,24}интеграц/i,
        /\bintegration\s+details\b/i,
        /\bintegrations?\s+needed\b/i,
      ],
      weight: 2,
    },
    {
      signal: "company or market investigation",
      patterns: [
        /компани/i,
        /рынок/i,
        /\bcompany\b/i,
        /\bmarket\b/i,
        /\binvestigat/i,
      ],
    },
  ],
  "Closer Agent": [
    {
      signal: "proposal",
      patterns: [
        /отправьте\s+(коммерческое\s+)?предложение/i,
        /коммерческое\s+предложение/i,
        /\bsend\s+(a\s+)?proposal\b/i,
        /\bproposal\b/i,
      ],
      weight: 2,
    },
    {
      signal: "contract",
      patterns: [/контракт/i, /договор/i, /\bcontract\b/i],
      weight: 2,
    },
    {
      signal: "negotiation",
      patterns: [/согласуем\s+условия/i, /обсудим/i, /\bnegotiate\b/i, /\bterms\b/i],
    },
    {
      signal: "purchase intent",
      patterns: [/готовы\s+покупать/i, /купить/i, /\bready\s+to\s+buy\b/i, /\bpurchase\b/i],
      weight: 2,
    },
    {
      signal: "decision or approval",
      patterns: [/одобрен/i, /согласовано/i, /\bapproved\b/i, /\bapproval\b/i, /\bdecision\b/i],
    },
    {
      signal: "closing next step",
      patterns: [/закрываем/i, /следующий\s+шаг.{0,24}сделк/i, /\bclose\b/i, /\bclosing\b/i],
    },
  ],
  "Operations Agent": [
    {
      signal: "human review gate",
      patterns: [
        /нужно\s+согласование/i,
        /согласован/i,
        /требуется\s+юридическая\s+проверка/i,
        /юридическ/i,
        /проверка\s+договора/i,
        /закупк/i,
        /\bapproval\b/i,
        /\bapproval\s+from\b/i,
        /\bprocurement\b/i,
        /\blegal\b/i,
        /\blegal\s+review\b/i,
        /\bcontract\s+review\b/i,
        /\bcompliance\b/i,
      ],
      weight: 3,
    },
    {
      signal: "task creation",
      patterns: [/создай\s+задачу/i, /поставь\s+задачу/i, /\bcreate\s+(a\s+)?task\b/i],
      weight: 2,
    },
    {
      signal: "process coordination",
      patterns: [/организуй\s+процесс/i, /координир/i, /\bcoordinate\b/i, /\bcoordination\b/i],
      weight: 2,
    },
    {
      signal: "scheduling operations",
      patterns: [/запланируй/i, /расписани/i, /\bschedule\b/i, /\bscheduling\b/i],
    },
    {
      signal: "workflow management",
      patterns: [/workflow/i, /воркфлоу/i, /процесс/i, /\bworkflow\b/i],
    },
    {
      signal: "internal next steps",
      patterns: [
        /назначь\s+следующий\s+шаг/i,
        /следующий\s+шаг/i,
        /\bassign\s+(the\s+)?next\s+step\b/i,
        /\bnext\s+step\b/i,
      ],
      weight: 2,
    },
    {
      signal: "handoff or escalation",
      patterns: [
        /передай\s+команде/i,
        /эскал/i,
        /\bhandoff\b/i,
        /\bhand\s+off\b/i,
        /\bescalat/i,
      ],
      weight: 2,
    },
  ],
};

export function routeRevenueAgent(message: string): RevenueAgent {
  return routeRevenueAgentDecision(message).selectedAgent;
}

export function routeRevenueAgentDecision(
  message: string
): RevenueRoutingDecision {
  const scores = createEmptyScores();
  const matchedSignals = createEmptyMatchedSignals();
  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return buildFallbackDecision(scores, matchedSignals);
  }

  for (const agent of AGENTS) {
    for (const rule of ROUTING_RULES[agent]) {
      if (
        rule.patterns.some((pattern) =>
          pattern.test(normalizedMessage)
        )
      ) {
        scores[agent] += rule.weight ?? 1;
        matchedSignals[agent].push(rule.signal);
      }
    }
  }

  const rankedAgents = [...AGENTS].sort(
    (left, right) => scores[right] - scores[left]
  );
  const selectedAgent = rankedAgents[0];
  const selectedScore = scores[selectedAgent];
  const runnerUpScore = scores[rankedAgents[1]];

  if (selectedScore === 0) {
    return buildFallbackDecision(scores, matchedSignals);
  }

  const confidence = estimateConfidence({
    selectedScore,
    runnerUpScore,
    matchedSignalCount: matchedSignals[selectedAgent].length,
  });
  const rationale = [
    `Selected ${selectedAgent} because the message matched ${formatSignals(
      matchedSignals[selectedAgent]
    )}.`,
    `Scores: ${formatScores(scores)}.`,
  ].join(" ");

  return {
    selectedAgent,
    selected_agent: selectedAgent,
    scores,
    matchedSignals,
    matched_signals: matchedSignals,
    rationale,
    confidence,
  };
}

function createEmptyScores() {
  return AGENTS.reduce(
    (scores, agent) => ({
      ...scores,
      [agent]: 0,
    }),
    {} as Record<RevenueAgent, number>
  );
}

function createEmptyMatchedSignals() {
  return AGENTS.reduce(
    (signals, agent) => ({
      ...signals,
      [agent]: [],
    }),
    {} as Record<RevenueAgent, string[]>
  );
}

function buildFallbackDecision(
  scores: Record<RevenueAgent, number>,
  matchedSignals: Record<RevenueAgent, string[]>
): RevenueRoutingDecision {
  const rationale =
    "No deterministic routing signals were strong enough; defaulted to SDR Agent for initial qualification.";

  return {
    selectedAgent: "SDR Agent",
    selected_agent: "SDR Agent",
    scores,
    matchedSignals,
    matched_signals: matchedSignals,
    rationale,
    confidence: UNCERTAIN_CONFIDENCE,
  };
}

function estimateConfidence({
  selectedScore,
  runnerUpScore,
  matchedSignalCount,
}: {
  selectedScore: number;
  runnerUpScore: number;
  matchedSignalCount: number;
}) {
  const margin = selectedScore - runnerUpScore;
  const base = 0.55 + selectedScore * 0.08 + margin * 0.08;
  const multiSignalBonus = matchedSignalCount > 1 ? 0.08 : 0;

  return Math.min(0.95, Number((base + multiSignalBonus).toFixed(2)));
}

function formatSignals(signals: string[]) {
  if (signals.length === 0) {
    return "no explicit signals";
  }

  return signals.join(", ");
}

function formatScores(scores: Record<RevenueAgent, number>) {
  return AGENTS.map((agent) => `${agent}=${scores[agent]}`).join(", ");
}
