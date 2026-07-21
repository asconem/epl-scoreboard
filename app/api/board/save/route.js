import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { saveBoard } from "@/lib/redis";
export const dynamic = "force-dynamic";
export async function POST(req) {
  const token = cookies().get("epl_admin")?.value;
  if (!isAdmin(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const saved = await saveBoard(body);
  return NextResponse.json(saved);
}
