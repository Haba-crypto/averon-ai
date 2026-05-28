export type AgentRegistryItem = {
  id: string;
  name: string;
  description: string;
  role: string;
  status: string;
  tasks: number;
  conversations: number;
  revenue: string;
  detailMetrics: {
    activeTasks: number;
    conversion: string;
    aiState: string;
    decisions: number;
    leadsProcessed: number;
    accuracy: string;
    activeWorkflows: number;
  };
  objective: string;
  recommendations: string[];
  terminalLogs: string[];
};

export const agentRegistry: AgentRegistryItem[] = [
  {
    id: "sdr",
    name: "SDR Agent",
    description: "Autonomous outbound prospecting and qualification.",
    role: "Lead Qualification",
    status: "active",
    tasks: 148,
    conversations: 82,
    revenue: "$42K",
    detailMetrics: {
      activeTasks: 24,
      conversion: "38%",
      aiState: "Autonomous",
      decisions: 184,
      leadsProcessed: 42,
      accuracy: "96%",
      activeWorkflows: 18,
    },
    objective:
      "Increase enterprise lead conversion through AI-driven qualification, automated follow-up orchestration, and intelligent CRM memory synchronization.",
    recommendations: [
      "Contact Tesla within 24h",
      "Schedule enterprise demo",
      "Increase outbound volume",
      "Trigger automated follow-up workflow",
    ],
    terminalLogs: [
      "[AVERON] SDR Agent initialized...",
      "Analyzing lead behavior patterns...",
      "Extracting buying intent signals...",
      "Intent score increased -> 85%",
      "Generating follow-up sequence...",
      "Updating CRM memory...",
      "Outbound workflow triggered",
      "Waiting for next task...",
    ],
  },
  {
    id: "closer",
    name: "Closer Agent",
    description: "Handles demos, objections, and deal progression.",
    role: "Deal Progression",
    status: "active",
    tasks: 64,
    conversations: 31,
    revenue: "$118K",
    detailMetrics: {
      activeTasks: 17,
      conversion: "44%",
      aiState: "Active",
      decisions: 126,
      leadsProcessed: 28,
      accuracy: "94%",
      activeWorkflows: 12,
    },
    objective:
      "Move qualified opportunities through demos, objection handling, urgency evaluation, and next-step execution.",
    recommendations: [
      "Review high-intent demo requests",
      "Resolve pricing objections",
      "Advance qualified opportunities",
      "Escalate complex enterprise blockers",
    ],
    terminalLogs: [
      "[AVERON] Closer Agent initialized...",
      "Reviewing demo readiness...",
      "Evaluating objection context...",
      "Close probability recalculated",
      "Next-step recommendation generated",
      "Deal progression updated",
      "Waiting for next task...",
    ],
  },
  {
    id: "research",
    name: "Research Agent",
    description: "Enriches leads with company and market intelligence.",
    role: "Account Intelligence",
    status: "active",
    tasks: 203,
    conversations: 0,
    revenue: "$0",
    detailMetrics: {
      activeTasks: 31,
      conversion: "N/A",
      aiState: "Researching",
      decisions: 218,
      leadsProcessed: 76,
      accuracy: "97%",
      activeWorkflows: 22,
    },
    objective:
      "Strengthen lead context with account research, company signals, market notes, and CRM enrichment.",
    recommendations: [
      "Enrich enterprise account profiles",
      "Identify market-fit signals",
      "Update missing company context",
      "Flag high-value account changes",
    ],
    terminalLogs: [
      "[AVERON] Research Agent initialized...",
      "Researching enterprise account...",
      "Enriching company profile...",
      "Extracting market signals...",
      "Lead enrichment completed",
      "CRM memory updated",
      "Waiting for next task...",
    ],
  },
  {
    id: "ops",
    name: "Ops Agent",
    description: "Optimizes CRM workflows and pipeline operations.",
    role: "Revenue Operations",
    status: "active",
    tasks: 91,
    conversations: 12,
    revenue: "$18K",
    detailMetrics: {
      activeTasks: 19,
      conversion: "32%",
      aiState: "Coordinating",
      decisions: 156,
      leadsProcessed: 39,
      accuracy: "95%",
      activeWorkflows: 16,
    },
    objective:
      "Coordinate workflow routing, CRM updates, task hygiene, and pipeline execution pressure.",
    recommendations: [
      "Clear stale workflow tasks",
      "Rebalance overloaded review paths",
      "Archive superseded recommendations",
      "Route blocked work to operator review",
    ],
    terminalLogs: [
      "[AVERON] Ops Agent initialized...",
      "Monitoring CRM activity...",
      "Synchronizing sales pipeline...",
      "Workflow pressure checked",
      "Pipeline updated successfully",
      "Operational route selected",
      "Waiting for next task...",
    ],
  },
];

export function getAgentById(agentId: string) {
  return agentRegistry.find((agent) => agent.id === agentId);
}
