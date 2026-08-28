"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Trophy, Zap, RefreshCw, X, ChevronDown, ChevronRight, ChevronLeft, LogOut, Ghost, Table2, DownloadCloud, Flag } from "lucide-react";
import { CLUBS, CMAP, CODE, computeScores, rankStables, upsetGap, matchResult, isFinished, isLive, hasCompleteSeason, matchesInWeek, currentMatchweek, MATCHWEEKS, TOTAL_MATCHES, WIN } from "@/lib/clubs";
import { OWNERS, OWNER_CONFIG_VERSION, configProblems } from "@/lib/pool-config";

const C = {
  paper: "#16181C", ink: "#EDEDEA", pitch: "#9EF01A", line: "#2A2E35",
  lineStrong: "#3A404A", muted: "#8B9199", gold: "#E0A93B", goldBg: "#2A2415", white: "#1E2127",
  ghost: "#9A93B5", onAccent: "#0C1005", relegate: "#FF6B5E",
};
const OSW = "'Oswald', system-ui, sans-serif";
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const EMPTY_NAMES = { 1: "", 2: "", 3: "", 4: "", 5: "The Leftovers" };

export default function BoardClient({ admin }) {
  const [matches, setMatches] = useState([]);
  const [names, setNames] = useState(EMPTY_NAMES);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [mw, setMw] = useState(null); // null = current
  const [editing, setEditing] = useState(null); // match id being scored inline
  const [ega, setEga] = useState("");
  const [egb, setEgb] = useState("");
  const [addOpen, setAddOpen] = useState(false); // manual add-fixture form (fallback only)
  const [naClubA, setNaClubA] = useState("");
  const [naClubB, setNaClubB] = useState("");
  const [naMw, setNaMw] = useState(1);
  const [flash, setFlash] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const version = useRef(0);
  const saving = useRef(false);

  const problems = useMemo(() => configProblems(), []);

  async function pull(initial) {
    if (saving.current && !initial) return;
    try {
      const r = await fetch("/api/board", { cache: "no-store" });
      const d = await r.json();
      if (initial || (d.version || 0) > version.current) {
        version.current = d.version || 0;
        setMatches(d.matches || []);
        setNames(d.names || EMPTY_NAMES);
        setSeasonComplete(!!d.seasonComplete);
        setSynced(new Date());
      }
    } catch (e) { /* ignore */ }
    if (initial) setLoading(false);
  }
  useEffect(() => { pull(true); const id = setInterval(() => pull(false), 15000); return () => clearInterval(id); }, []);

  async function persist(nextMatches, nextNames, nextComplete) {
    const previousMatches = matches, previousNames = names, previousComplete = seasonComplete;
    saving.current = true;
    setMatches(nextMatches); setNames(nextNames); setSeasonComplete(nextComplete);
    try {
      const r = await fetch("/api/board/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: nextMatches, names: nextNames, seasonComplete: nextComplete, ownerConfigVersion: OWNER_CONFIG_VERSION }),
      });
      if (!r.ok) throw new Error(`save returned ${r.status}`);
      const d = await r.json();
      version.current = d.version; setSynced(new Date());
    } catch (e) {
      setMatches(previousMatches); setNames(previousNames); setSeasonComplete(previousComplete);
      setFlash({ upset: false, error: true, text: "Save failed — your change was not stored. The board has been reloaded." });
      await pull(true);
      setTimeout(() => setFlash(null), 5000);
    } finally {
      saving.current = false;
    }
  }

  async function syncResults() {
    setSyncing(true);
    try {
      const r = await fetch("/api/ingest", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setFlash({ upset: false, text: `Synced — ${d.added} added, ${d.updated} updated${d.skipped ? `, ${d.skipped} manual kept` : ""}` });
        await pull(true);
      } else {
        setFlash({ upset: false, text: `Sync failed: ${d.error || r.status}` });
      }
    } catch (e) { setFlash({ upset: false, text: "Sync failed: network error" }); }
    setSyncing(false);
    setTimeout(() => setFlash(null), 4000);
  }

  const scores = useMemo(() => computeScores(matches, seasonComplete), [matches, seasonComplete]);
  const ranked = useMemo(() => rankStables(scores), [scores]);
  const curMw = useMemo(() => currentMatchweek(matches), [matches]);
  const viewMw = mw || curMw;
  const weekFixtures = useMemo(() => matchesInWeek(matches, viewMw), [matches, viewMw]);
  const liveCount = useMemo(() => matches.filter(isLive).length, [matches]);
  // Group the week's fixtures into ordered day buckets. Fixtures with no date
  // yet (manually added, pre-sync) fall into a trailing "TBD" bucket so they
  // still show. matchesInWeek already sorts by date then club, so within each
  // bucket order is correct and the buckets themselves come out chronological.
  const dayGroups = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const m of weekFixtures) {
      const key = m.date || "TBD";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key).push(m);
    }
    return order.map(key => ({ key, fixtures: map.get(key) }));
  }, [weekFixtures]);
  const configured = problems.length === 0;

  const nm = (s) => (names[s] && String(names[s]).trim()) || OWNERS[s] || `Stable ${s}`;
  const ownerOf = (club) => { const c = CMAP[club]; return c && c.s ? nm(c.s) : null; };

  function beginEdit(m) {
    setEditing(m.id);
    setEga(Number.isFinite(m.ga) ? String(m.ga) : "");
    setEgb(Number.isFinite(m.gb) ? String(m.gb) : "");
  }
  function cancelEdit() { setEditing(null); setEga(""); setEgb(""); }

  // Save a score directly onto an existing fixture row. Home/away come from the
  // fixture itself — no club selection. Marks the row manual so the sync won't
  // clobber a hand-entered correction.
  function saveRowScore(m) {
    const A = parseInt(ega, 10), B = parseInt(egb, 10);
    if (!(A >= 0 && B >= 0)) return;
    const next = matches.map(x => x.id === m.id ? { ...x, ga: A, gb: B, status: "F", manual: true } : x);
    persist(next, names, seasonComplete);
    const res = A > B ? "A" : (B > A ? "B" : "D");
    const w = res === "A" ? m.a : m.b, l = res === "A" ? m.b : m.a;
    const g = res === "D" ? 0 : upsetGap(w, l);
    setFlash(g ? { upset: true, text: `Upset! ${w} over ${l}  +${g}` } : { upset: false, text: res === "D" ? `${m.a} ${A}–${B} ${m.b} · draw` : `${w} win logged` });
    cancelEdit();
    setTimeout(() => setFlash(null), 3000);
  }

  // Fallback: add a fixture the sync doesn't have (rare — e.g. before the first
  // sync, or a rescheduled game). Adds it scheduled with no score; you then
  // score it inline like any other row.
  function addFixture() {
    if (!naClubA || !naClubB || naClubA === naClubB) return;
    const dup = matches.find(m => m.mw === naMw && [m.a, m.b].sort().join() === [naClubA, naClubB].sort().join());
    if (dup) { setFlash({ upset: false, text: "That fixture already exists in this matchweek" }); setTimeout(() => setFlash(null), 3000); return; }
    const rec = { id: `m:${Date.now()}`, mw: naMw, date: null, a: naClubA, b: naClubB, ga: null, gb: null, status: "S", manual: true };
    persist([...matches, rec], names, seasonComplete);
    setNaClubA(""); setNaClubB(""); setAddOpen(false);
    setMw(naMw);
    setFlash({ upset: false, text: `Fixture added to MW ${naMw} — score it in the matchweek panel` });
    setTimeout(() => setFlash(null), 3200);
  }
  function delMatch(id) { persist(matches.filter(m => m.id !== id), names, seasonComplete); }
  function setName(s, v) { persist(matches, { ...names, [s]: v }, seasonComplete); }
  function toggleComplete() {
    const next = !seasonComplete;
    if (next && !hasCompleteSeason(matches)) {
      setFlash({ upset: false, error: true, text: `Season cannot be completed until all ${TOTAL_MATCHES} fixtures have final scores.` });
      setTimeout(() => setFlash(null), 5000);
      return;
    }
    if (next && !window.confirm("Mark the season complete? Milestone points (+15 title, +10 top 4, −10 relegation) will be applied from the final table.")) return;
    persist(matches, names, next);
  }
  function resetAll() { if (!window.confirm("Clear every result and start the season over?")) return; persist([], names, false); }
  async function logout() { await fetch("/api/logout", { method: "POST" }); window.location.href = "/"; }

  const fmtDay = (dateStr) => {
    if (!dateStr) return null;
    const [y, mo, d] = String(dateStr).split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt) ? null : dt.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Day-group header label, e.g. "Saturday · Aug 22". "TBD" for undated fixtures.
  const fmtDayHeader = (dateStr) => {
    if (!dateStr || dateStr === "TBD") return "Date TBD";
    const [y, mo, d] = String(dateStr).split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    if (isNaN(dt)) return "Date TBD";
    return `${dt.toLocaleDateString([], { weekday: "long" })} · ${dt.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  };

  // Kickoff time from the full ISO timestamp, in the viewer's local zone.
  // Fixtures the Premier League hasn't scheduled yet come back as a 00:00 UTC
  // placeholder — we return null for those so the board never shows a wall of
  // identical fake times. As real times are assigned, a sync fills them in.
  const fmtTime = (utc) => {
    if (!utc) return null;
    const dt = new Date(utc);
    if (isNaN(dt)) return null;
    if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0) return null; // unscheduled placeholder
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const btn = { fontFamily: "inherit", fontSize: 14, padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.lineStrong}`, background: C.white, color: C.ink, cursor: "pointer", fontWeight: 500 };
  const sel = { fontFamily: "inherit", fontSize: 14, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.lineStrong}`, background: C.white, color: C.ink, width: "100%" };
  const tierBadge = (t) => (
    <span style={{ fontFamily: MONO, fontSize: 10, color: t === 1 ? C.onAccent : C.paper, background: t === 1 ? C.pitch : C.muted, borderRadius: 4, padding: "1px 5px" }}>{t ? `T${t}` : "T?"}</span>
  );

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Loading the board…</div>;

  return (
    <div style={{ background: C.paper, color: C.ink, padding: "24px 18px 48px", maxWidth: 760, margin: "0 auto", minHeight: "100vh" }}>
      <div style={{ borderBottom: `3px solid ${C.ink}`, paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: OSW, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: C.pitch, fontWeight: 600 }}>Premier League 2026–27 · Stable Pool</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontFamily: OSW, fontSize: 32, fontWeight: 700, textTransform: "uppercase", margin: "2px 0 0", lineHeight: 1 }}>Live Scoreboard</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => pull(false)} style={{ ...btn, display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", fontSize: 13 }}><RefreshCw size={14} /> Refresh</button>
            {admin && <button onClick={logout} style={{ ...btn, display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", fontSize: 13 }}><LogOut size={14} /> Log out</button>}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
          {admin ? <span style={{ color: C.pitch, fontWeight: 600 }}>Scorer mode</span> : "Read-only view"}
          {" · "}{synced ? `updated ${synced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "loading…"}
          {seasonComplete && <span style={{ color: C.gold, fontWeight: 600 }}> · Final — milestones applied</span>}
          {liveCount > 0 && <span style={{ color: C.relegate, fontWeight: 700 }}> · {liveCount} live · standings are provisional</span>}
        </div>
      </div>

      {/* setup banner until tiers + stables are configured */}
      {!configured &&
        <div style={{ marginBottom: 16, border: `1px solid ${C.gold}`, background: C.goldBg, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.ink }}>
          <div style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", fontSize: 12, color: C.gold, marginBottom: 4 }}>Setup needed — lib/pool-config.js</div>
          {problems.map((p, i) => <div key={i}>· {p}</div>)}
        </div>}

      {/* matchweek panel */}
      <div style={{ marginBottom: 16, border: `1px solid ${C.line}`, borderRadius: 10, background: C.white, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ width: 52, flex: "none", display: "flex", justifyContent: "flex-start" }}>
            {mw && mw !== curMw
              ? <button onClick={() => setMw(null)} style={{ ...btn, padding: "4px 10px", fontSize: 12 }}>Now</button>
              : null}
          </div>
          <button onClick={() => setMw(Math.max(1, viewMw - 1))} disabled={viewMw <= 1} style={{ ...btn, padding: "4px 8px", opacity: viewMw <= 1 ? 0.4 : 1, flex: "none" }}><ChevronLeft size={14} /></button>
          <span style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", fontSize: 13, color: C.pitch, flex: 1, textAlign: "center" }}>
            Matchweek {viewMw}{viewMw === curMw ? " · current" : ""}
          </span>
          <button onClick={() => setMw(Math.min(MATCHWEEKS, viewMw + 1))} disabled={viewMw >= MATCHWEEKS} style={{ ...btn, padding: "4px 8px", opacity: viewMw >= MATCHWEEKS ? 0.4 : 1, flex: "none" }}><ChevronRight size={14} /></button>
          <div style={{ width: 52, flex: "none" }} />
        </div>
        <div style={{ padding: "6px 12px 10px" }}>
          {weekFixtures.length === 0 &&
            <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>
              No fixtures loaded for this week{admin ? " — hit Sync fixtures & results below to pull the schedule." : " yet."}
            </div>}

          {dayGroups.map(({ key, fixtures }) => (
            <div key={key}>
              <div style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, color: C.muted, padding: "10px 0 4px", borderBottom: `1px solid ${C.line}`, marginBottom: 2 }}>
                {fmtDayHeader(key)}
              </div>
              {fixtures.map(m => {
                const done = isFinished(m);
                const live = isLive(m);
                const res = matchResult(m);
                const w = res === "A" ? m.a : res === "B" ? m.b : null;
                const g = w ? upsetGap(w, res === "A" ? m.b : m.a) : 0;
                const isEditing = editing === m.id;

                if (admin && isEditing) {
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px dotted ${C.line}`, fontSize: 14, background: "#20261A" }}>
                      <span style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>{m.a}</span>
                      <input type="number" min="0" autoFocus value={ega} onChange={e => setEga(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveRowScore(m); if (e.key === "Escape") cancelEdit(); }}
                        style={{ fontFamily: MONO, fontSize: 15, width: 38, textAlign: "center", padding: "4px 2px", borderRadius: 6, border: `1px solid ${C.lineStrong}`, background: C.white, color: C.ink }} />
                      <span style={{ color: C.muted }}>–</span>
                      <input type="number" min="0" value={egb} onChange={e => setEgb(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveRowScore(m); if (e.key === "Escape") cancelEdit(); }}
                        style={{ fontFamily: MONO, fontSize: 15, width: 38, textAlign: "center", padding: "4px 2px", borderRadius: 6, border: `1px solid ${C.lineStrong}`, background: C.white, color: C.ink }} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{m.b}</span>
                      <button onClick={() => saveRowScore(m)} disabled={!(parseInt(ega, 10) >= 0 && parseInt(egb, 10) >= 0)}
                        style={{ ...btn, padding: "4px 9px", fontSize: 12, background: C.pitch, color: C.onAccent, borderColor: C.pitch }}>Save</button>
                      <X size={15} color={C.muted} style={{ cursor: "pointer", flex: "none" }} onClick={cancelEdit} />
                    </div>
                  );
                }

                return (
                  <div key={m.id}
                    onClick={admin ? () => beginEdit(m) : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px dotted ${C.line}`, fontSize: 14, cursor: admin ? "pointer" : "default" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, width: 58, flex: "none", whiteSpace: "nowrap" }}>
                      {live ? <span style={{ color: C.relegate, fontWeight: 700 }}>LIVE</span> : (!done && fmtTime(m.utc) ? fmtTime(m.utc) : "")}
                    </span>
                    <span style={{ flex: 1, textAlign: "right", fontWeight: res === "A" ? 600 : 400 }}>{m.a}</span>
                    <span style={{ fontFamily: MONO, fontSize: 14, width: 44, textAlign: "center", color: live ? C.relegate : (done ? C.ink : (admin ? C.pitch : C.muted)) }}>
                      {done || live ? `${m.ga}–${m.gb}` : (admin ? "＋" : "v")}
                    </span>
                    <span style={{ flex: 1, fontWeight: res === "B" ? 600 : 400 }}>{m.b}</span>
                    <span style={{ width: 34, flex: "none", textAlign: "right" }}>
                      {g > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.gold }}>+{g}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {admin && weekFixtures.length > 0 &&
            <div style={{ fontSize: 11, color: C.muted, paddingTop: 6 }}>Tap any fixture to enter or fix its score. Home/away come from the fixture — no need to pick sides.</div>}
        </div>
      </div>

      {/* pool standings */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranked.map((row, i) => {
          const isLead = i === 0 && row.total > 0;
          const isGhost = row.s === 5;
          const open = expanded === row.s;
          const clubs = CLUBS.filter(c => c.s === row.s).sort((a, b) => (a.t || 9) - (b.t || 9));
          return (
            <div key={row.s} style={{ border: `1px solid ${isLead ? C.gold : C.line}`, borderRadius: 10, background: C.white, overflow: "hidden" }}>
              <div onClick={() => setExpanded(open ? null : row.s)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", cursor: "pointer" }}>
                <div style={{ fontFamily: OSW, fontSize: 22, fontWeight: 700, width: 26, color: isLead ? C.gold : C.muted, textAlign: "center" }}>{i + 1}</div>
                {isLead && <Trophy size={18} color={C.gold} />}
                {isGhost && <Ghost size={16} color={C.ghost} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {admin && !isGhost
                    ? <input value={names[row.s] || ""} onClick={e => e.stopPropagation()} onChange={e => setName(row.s, e.target.value)} placeholder={`Owner ${row.s}`}
                        style={{ fontFamily: OSW, fontWeight: 600, fontSize: 17, border: "none", background: "transparent", color: C.ink, width: "100%", outline: "none", padding: 0 }} />
                    : <div style={{ fontFamily: OSW, fontWeight: 600, fontSize: 17, color: isGhost ? C.ghost : C.ink }}>{nm(row.s)}</div>}
                  <div style={{ fontSize: 11, color: C.muted }}>
                    GD {row.gd > 0 ? `+${row.gd}` : row.gd} · {row.gf} goals · {row.upset} upset pts
                    {isGhost && " · wins roll the pot over"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: C.pitch, lineHeight: 1 }}>{row.total}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>pts</div>
                </div>
                {open ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
              </div>
              {open &&
                <div style={{ borderTop: `1px solid ${C.line}`, padding: "6px 12px 10px" }}>
                  {clubs.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "4px 0" }}>Clubs are assigned on draft night.</div>}
                  {clubs.map(c => {
                    const pos = scores.position[c.n];
                    const ms = scores.milestones[c.n];
                    const d = scores.detail[c.n];
                    return (
                      <div key={c.n} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", borderBottom: `1px dotted ${C.line}` }}>
                        {tierBadge(c.t)}
                        <span style={{ flex: 1, fontSize: 14 }}>{c.n}</span>
                        {ms && <span style={{ fontFamily: OSW, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: ms.value > 0 ? C.gold : C.muted, border: `1px solid ${ms.value > 0 ? C.gold : C.lineStrong}`, borderRadius: 4, padding: "0 4px" }}>{ms.label} {ms.value > 0 ? `+${ms.value}` : ms.value}</span>}
                        {pos && <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{pos}{ordinal(pos)}</span>}
                        <span style={{ fontSize: 11, color: C.muted }}>{d.w}-{d.d}-{d.l}</span>
                        {d.upset > 0 && <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>+{d.upset} ups</span>}
                        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>{scores.pts[c.n]}</span>
                      </div>
                    );
                  })}
                </div>}
            </div>
          );
        })}
      </div>

      {/* real league table */}
      <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 10, background: C.white, overflow: "hidden" }}>
        <div onClick={() => setShowTable(!showTable)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer" }}>
          <Table2 size={15} color={C.pitch} />
          <span style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", fontSize: 13, color: C.pitch, flex: 1 }}>League table</span>
          <span style={{ fontSize: 12, color: C.muted }}>{showTable ? "Hide" : "Show"}</span>
          {showTable ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />}
        </div>
        {showTable &&
          <div style={{ borderTop: `1px solid ${C.line}`, padding: "6px 12px 10px" }}>
            {scores.table.map((r, i) => {
              const pos = i + 1;
              const zone = pos === 1 ? C.gold : pos <= 4 ? C.pitch : pos >= 18 ? C.relegate : "transparent";
              const c = CMAP[r.club];
              return (
                <div key={r.club} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: `1px dotted ${C.line}`, fontSize: 13 }}>
                  <span style={{ width: 3, alignSelf: "stretch", background: zone, borderRadius: 2, flex: "none" }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, width: 20, textAlign: "right" }}>{pos}</span>
                  <span style={{ flex: 1 }}>{r.club}</span>
                  {c && c.s && <span style={{ fontFamily: OSW, fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: c.s === 5 ? C.ghost : C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: "0 4px" }}>{nm(c.s)}</span>}
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, width: 24, textAlign: "right" }}>{r.p}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, width: 30, textAlign: "right" }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, width: 26, textAlign: "right" }}>{r.pts}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: C.muted, paddingTop: 6 }}>P · GD · Pts — gold: title (+15) · green: top 4 (+10) · red: relegation (−10)</div>
          </div>}
      </div>

      {/* admin tools */}
      {admin &&
        <div style={{ marginTop: 22, border: `1px solid ${C.line}`, borderRadius: 10, background: C.white, padding: 14 }}>
          <div style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 13, color: C.pitch, marginBottom: 10 }}>Scorer tools</div>

          <button onClick={syncResults} disabled={syncing} style={{ ...btn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.pitch, color: C.onAccent, borderColor: C.pitch, opacity: syncing ? 0.7 : 1 }}>
            <DownloadCloud size={15} /> {syncing ? "Syncing…" : "Sync fixtures & results"}
          </button>
          <div style={{ fontSize: 11, color: C.muted, margin: "6px 0 4px", textAlign: "center" }}>Pulls fixtures and finished scores from football-data.org. To enter or correct a score by hand, tap its fixture in the matchweek panel above — your hand-entered scores are never overwritten by a sync.</div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
            <div onClick={() => setAddOpen(!addOpen)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.muted }}>
              {addOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Add a missing fixture
            </div>
            {addOpen &&
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Only needed if a fixture isn&apos;t in the list (e.g. before the first sync, or a rescheduled game). It&apos;s added blank — then score it in the matchweek panel.</div>
                <div style={{ display: "grid", gridTemplateColumns: "76px 1fr 1fr", gap: 8 }}>
                  <select value={naMw} style={sel} onChange={e => setNaMw(parseInt(e.target.value, 10))}>
                    {Array.from({ length: MATCHWEEKS }, (_, i) => i + 1).map(n => <option key={n} value={n}>MW {n}</option>)}
                  </select>
                  <select value={naClubA} style={sel} onChange={e => { setNaClubA(e.target.value); if (e.target.value === naClubB) setNaClubB(""); }}>
                    <option value="">Home…</option>
                    {CLUBS.map(c => <option key={c.n} value={c.n}>{c.n}</option>)}
                  </select>
                  <select value={naClubB} style={sel} disabled={!naClubA} onChange={e => setNaClubB(e.target.value)}>
                    <option value="">Away…</option>
                    {CLUBS.filter(c => c.n !== naClubA).map(c => <option key={c.n} value={c.n}>{c.n}</option>)}
                  </select>
                </div>
                <button onClick={addFixture} disabled={!naClubA || !naClubB} style={{ ...btn, marginTop: 8, width: "100%", fontSize: 13 }}>Add fixture</button>
              </div>}
          </div>

          {flash &&
            <div style={{ marginTop: 10, padding: "8px 11px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: flash.error ? "#2B1919" : (flash.upset ? C.goldBg : "#1C2618"), color: flash.error ? C.relegate : (flash.upset ? C.gold : C.pitch), display: "flex", alignItems: "center", gap: 7 }}>
              {flash.upset && <Zap size={15} />} {flash.text}
            </div>}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
            <Flag size={14} color={seasonComplete ? C.gold : C.muted} />
            <span style={{ flex: 1, fontSize: 13 }}>Season complete — apply milestones</span>
            <button onClick={toggleComplete} style={{ ...btn, padding: "5px 12px", fontSize: 12, background: seasonComplete ? C.gold : C.white, color: seasonComplete ? C.onAccent : C.ink, borderColor: seasonComplete ? C.gold : C.lineStrong }}>
              {seasonComplete ? "On" : "Off"}
            </button>
          </div>
        </div>}

      {/* results log */}
      <div style={{ marginTop: 22, border: `1px solid ${C.line}`, borderRadius: 10, background: C.white, overflow: "hidden" }}>
        <div onClick={() => setShowResults(!showResults)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}>
          <span style={{ fontFamily: OSW, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 13, color: C.pitch, flex: 1 }}>Results ({matches.filter(isFinished).length})</span>
          <span style={{ fontSize: 12, color: C.muted }}>{showResults ? "Hide" : "Show all"}</span>
          {showResults ? <ChevronDown size={15} color={C.muted} /> : <ChevronRight size={15} color={C.muted} />}
        </div>
        {showResults &&
          <div style={{ borderTop: `1px solid ${C.line}`, padding: "10px 12px 12px" }}>
            {matches.filter(isFinished).length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "4px 0" }}>No results yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...matches].filter(isFinished).sort((a, b) => (b.mw - a.mw) || String(b.date || "").localeCompare(String(a.date || ""))).map(m => {
                const res = matchResult(m);
                const draw = res === "D";
                const w = res === "A" ? m.a : m.b, l = res === "A" ? m.b : m.a;
                const g = draw ? 0 : upsetGap(w, l);
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: `1px solid ${g ? C.gold : C.line}`, borderRadius: 8, background: C.white }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, width: 52, flex: "none" }}>
                      <span style={{ fontFamily: OSW, fontSize: 10, color: C.pitch, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, lineHeight: 1.2 }}>MW {m.mw}</span>
                      {m.date && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, lineHeight: 1.2 }}>{fmtDay(m.date)}</span>}
                    </span>
                    <span style={{ flex: 1, fontSize: 14 }}>
                      <span style={{ fontWeight: res === "A" ? 600 : 400 }}>{m.a}</span> <span style={{ fontFamily: MONO }}>{m.ga}–{m.gb}</span> <span style={{ fontWeight: res === "B" ? 600 : 400 }}>{m.b}</span>
                      {m.manual && <span style={{ color: C.muted, fontSize: 11 }}> · manual</span>}
                    </span>
                    {g > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: C.gold }}><Zap size={12} />+{g}</span>}
                    <span style={{ fontFamily: MONO, fontSize: 13, color: C.pitch, fontWeight: 600 }}>{draw ? "1 / 1" : `+${WIN}`}</span>
                    {admin && <X size={15} color={C.muted} style={{ cursor: "pointer" }} onClick={() => delMatch(m.id)} />}
                  </div>
                );
              })}
            </div>
          </div>}
      </div>

      <div style={{ marginTop: 24, borderTop: `1px solid ${C.lineStrong}`, paddingTop: 12 }}>
        <div onClick={() => setShowKey(!showKey)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: C.muted, fontWeight: 500 }}>
          {showKey ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Scoring key
        </div>
        {showKey &&
          <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.7 }}>
            League matches only. Win 3, draw 1, loss 0. Upset bonus on any win by the lower-tier club: add the tier gap (1–3).
            After matchweek 38: title +15, each other top-4 club +10, each relegated club −10.
            Ties break by stable goal difference, then goals scored, then upset points.
            If The Leftovers wins, the pot rolls over to next season.
          </div>}
        {admin && <button onClick={resetAll} style={{ ...btn, marginTop: 12, fontSize: 12, padding: "6px 11px", color: C.muted }}>Reset season</button>}
        {!admin && <div style={{ marginTop: 12 }}><a href="/admin" style={{ fontSize: 12, color: C.muted }}>Scorer login →</a></div>}
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
