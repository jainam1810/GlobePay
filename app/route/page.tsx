// Post-login traffic director: sends each user to their world.
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";

export default async function RoutePage() {
    const session = await getSessionInfo();
    if (!session) redirect("/login");
    if (session.role === "globepay_admin") redirect("/admin");
    redirect("/portal");
}
