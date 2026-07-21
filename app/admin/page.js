import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";
export const dynamic = "force-dynamic";
export default function AdminPage() {
  const token = cookies().get("epl_admin")?.value;
  return <AdminClient authed={isAdmin(token)} />;
}
