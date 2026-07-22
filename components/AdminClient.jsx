"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import BoardClient from "./BoardClient";

export default function AdminClient({ authed }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  if (authed) return <BoardClient admin={true} />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(false);
    const r = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) window.location.reload();
    else { setErr(true); setPw(""); }
  }

  const OSW = "'Oswald', system-ui, sans-serif";
  return (
    <div style={{ maxWidth: 360, margin: "60px auto", padding: "0 18px", fontFamily: "system-ui, sans-serif", color: "#EDEDEA" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9EF01A", marginBottom: 6 }}>
        <Lock size={18} /><span style={{ fontFamily: OSW, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 13 }}>Scorer access</span>
      </div>
      <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, textTransform: "uppercase", margin: "0 0 14px" }}>Admin login</h1>
      <form onSubmit={submit}>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" autoFocus
          style={{ width: "100%", padding: "11px 12px", fontSize: 15, borderRadius: 8, border: `1px solid ${err ? "#FF6B5E" : "#3A404A"}`, background: "#1E2127", color: "#EDEDEA", marginBottom: 10 }} />
        <button type="submit" disabled={busy}
          style={{ width: "100%", padding: "11px 12px", fontSize: 15, fontWeight: 600, borderRadius: 8, border: "1px solid #9EF01A", background: "#9EF01A", color: "#0C1005", cursor: "pointer" }}>
          {busy ? "Checking…" : "Enter"}
        </button>
        {err && <div style={{ color: "#FF6B5E", fontSize: 13, marginTop: 8 }}>Wrong password.</div>}
      </form>
      <a href="/" style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "#8B9199" }}>← Back to the public board</a>
    </div>
  );
}
