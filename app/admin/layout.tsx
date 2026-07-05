import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";
import AdminShell from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSessionInfo();
    if (!session) redirect("/login");
    if (session.role !== "globepay_admin") redirect("/portal");
    return <AdminShell email={session.email}>{children}</AdminShell>;
}
