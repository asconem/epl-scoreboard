import { NextResponse } from "next/server";
import { getBoard } from "@/lib/redis";
import { hasActiveFixture, syncFootballData } from "@/lib/football-data";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const board = await getBoard();
  if (!hasActiveFixture(board.matches)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no active fixtures" });
  }
  try {
    return NextResponse.json({ ok: true, skipped: false, ...(await syncFootballData()) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "live sync failed" }, { status: 502 });
  }
}
