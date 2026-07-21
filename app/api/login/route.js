import { NextResponse } from "next/server";
import { adminToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req) {
  let password = "";
  try { ({ password } = await req.json()); } catch {}
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("epl_admin", adminToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
