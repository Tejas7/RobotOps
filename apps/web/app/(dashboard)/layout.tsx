import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopHeader />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
