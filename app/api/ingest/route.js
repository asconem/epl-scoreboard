import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { syncFootballData } from "@/lib/football-data";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get("epl_admin")?.value;
  if (!isAdmin(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await syncFootballData()) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "sync failed" }, { status: error.status || 502 });
  }
}
