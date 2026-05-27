import { requireUser } from "@/lib/auth/session";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) { 
  return <AuthenticatedDashboard>{children}</AuthenticatedDashboard>;
}

async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return <DashboardShell>{children}</DashboardShell>;

}
