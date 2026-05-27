import { requireUser } from "@/lib/auth/session";

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

  return (

    <div className="min-h-screen">

      {children}

    </div>

  );

}
