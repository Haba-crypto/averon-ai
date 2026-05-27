export type RevenueAgent =
  | "SDR Agent"
  | "Closer Agent"
  | "Research Agent"
  | "Customer Success Agent";

export function routeRevenueAgent(message: string): RevenueAgent {
  const lower = message.toLowerCase();

  if (
    lower.includes("pricing") ||
    lower.includes("contract") ||
    lower.includes("close")
  ) {
    return "Closer Agent";
  }

  if (
    lower.includes("research") ||
    lower.includes("company") ||
    lower.includes("market")
  ) {
    return "Research Agent";
  }

  if (
    lower.includes("support") ||
    lower.includes("onboarding") ||
    lower.includes("retention")
  ) {
    return "Customer Success Agent";
  }

  return "SDR Agent";
}
