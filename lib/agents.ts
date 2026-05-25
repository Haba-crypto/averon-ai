export const agents = [
    {
      id: "sdr-agent",
  
      name: "SDR Agent",
  
      role: "Lead Qualification",
  
      specialization: [
        "qualification",
        "discovery",
        "lead scoring",
      ],
  
      status: "online",
  
      workload: 84,
    },
  
    {
      id: "closer-agent",
  
      name: "Closer Agent",
  
      role: "Sales Conversion",
  
      specialization: [
        "sales",
        "demo booking",
        "closing",
      ],
  
      status: "busy",
  
      workload: 92,
    },
  
    {
      id: "research-agent",
  
      name: "Research Agent",
  
      role: "Data Enrichment",
  
      specialization: [
        "research",
        "company analysis",
        "enrichment",
      ],
  
      status: "online",
  
      workload: 61,
    },
  
    {
      id: "retention-agent",
  
      name: "Retention Agent",
  
      role: "Customer Retention",
  
      specialization: [
        "upsell",
        "retention",
        "follow-up",
      ],
  
      status: "idle",
  
      workload: 28,
    },
  ];
  
  export function assignAgent(
    message: string
  ) {
    const lower =
      message.toLowerCase();
  
    // SALES / CLOSER
  
    if (
      lower.includes("demo") ||
      lower.includes("price") ||
      lower.includes("pricing") ||
      lower.includes("стоимость") ||
      lower.includes("цена") ||
      lower.includes("сколько стоит") ||
      lower.includes("внедрение") ||
      lower.includes("buy") ||
      lower.includes("purchase")
    ) {
      return agents.find(
        (agent) =>
          agent.id ===
          "closer-agent"
      );
    }
  
    // RESEARCH
  
    if (
      lower.includes("company") ||
      lower.includes("research") ||
      lower.includes("данные") ||
      lower.includes("анализ")
    ) {
      return agents.find(
        (agent) =>
          agent.id ===
          "research-agent"
      );
    }
  
    // RETENTION
  
    if (
      lower.includes("cancel") ||
      lower.includes("refund") ||
      lower.includes("проблем") ||
      lower.includes("ошибка")
    ) {
      return agents.find(
        (agent) =>
          agent.id ===
          "retention-agent"
      );
    }
  
    // DEFAULT → SDR
  
    return agents.find(
      (agent) =>
        agent.id ===
        "sdr-agent"
    );
  }