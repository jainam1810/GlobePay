// The old single-tenant payroll page is superseded by the client portal
// (/portal) and the operator console (/admin). Send everyone through the
// role router — it lands admins in /admin, clients in /portal, guests at /login.
import { redirect } from "next/navigation";

export default function Home() {
    redirect("/route");
}
