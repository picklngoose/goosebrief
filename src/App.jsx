import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Search,
  X,
} from "lucide-react";

const SPEECHES = ["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"];
const STORAGE_KEY = "case-prep-data";

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function makeRow(label = "") {
  const cells = {};
  SPEECHES.forEach((s) => (cells[s] = ""));
  return { id: uid(), label, cells };
}

function makeFlow() {
  return {
    id: uid(),
    title: "New flow",
    date: new Date().toISOString().slice(0, 10),
    rows: [makeRow()],
  };
}

function makeCase() {
  return {
    id: uid(),
    name: "",
    teams: [],
    strength: 3,
    docLink: "",
    gooseflowLink: "",
    notes: "",
    flows: [],
  };
}

const STRENGTH_META = {
  1: { label: "Weak — beat it easily", color: "#5FA88F" },
  2: { label: "Manageable", color: "#7FAE87" },
  3: { label: "Even matchup", color: "#D4A054" },
  4: { label: "Strong — needs real prep", color: "#C97A4A" },
  5: { label: "Very strong — biggest threat", color: "#C1584A" },
};

/* ---------------------------------- Style ---------------------------------- */

function StyleBlock() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');

      .cp-root {
        --cp-bg: #14161a;
        --cp-surface: #1b1e24;
        --cp-surface2: #20242b;
        --cp-border: #2a2e36;
        --cp-text: #edeae3;
        --cp-muted: #8b909b;
        --cp-accent: #d4a054;
        --cp-good: #5fa88f;
        --cp-bad: #c1584a;
        --cp-display: 'Space Grotesk', sans-serif;
        --cp-body: 'Inter', sans-serif;
        --cp-mono: 'IBM Plex Mono', monospace;
        font-family: var(--cp-body);
      }
      .cp-root * { box-sizing: border-box; }
      .cp-input {
        background: transparent;
        border: none;
        border-bottom: 1px solid transparent;
        color: var(--cp-text);
        outline: none;
        font-family: inherit;
        width: 100%;
        transition: border-color 0.15s ease;
      }
      .cp-input:hover { border-bottom-color: var(--cp-border); }
      .cp-input:focus { border-bottom-color: var(--cp-accent); }
      .cp-input::placeholder { color: var(--cp-muted); }
      .cp-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        border: 1px solid var(--cp-border);
        background: var(--cp-surface2);
        color: var(--cp-text);
        border-radius: 6px;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .cp-btn:hover { border-color: var(--cp-accent); }
      .cp-btn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        color: var(--cp-muted);
        border-radius: 6px;
        transition: color 0.15s ease, border-color 0.15s ease;
      }
      .cp-btn-icon:hover { color: var(--cp-text); border-color: var(--cp-border); }
      .cp-pip {
        cursor: pointer;
        transition: transform 0.1s ease;
      }
      .cp-pip:hover { transform: scale(1.15); }
      .cp-card {
        border: 1px solid var(--cp-border);
        background: var(--cp-surface);
        border-radius: 10px;
        transition: border-color 0.15s ease;
      }
      .cp-textarea {
        background: var(--cp-surface2);
        border: 1px solid var(--cp-border);
        color: var(--cp-text);
        border-radius: 6px;
        font-family: var(--cp-mono);
        font-size: 12px;
        outline: none;
        resize: none;
        transition: border-color 0.15s ease;
      }
      .cp-textarea:focus { border-color: var(--cp-accent); }
      .cp-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--cp-surface2);
        border: 1px solid var(--cp-border);
        border-radius: 999px;
        font-family: var(--cp-mono);
        font-size: 11px;
        color: var(--cp-text);
      }
      .cp-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .cp-scroll::-webkit-scrollbar-thumb { background: var(--cp-border); border-radius: 4px; }
      .cp-scroll::-webkit-scrollbar-track { background: transparent; }
    `}</style>
  );
}

/* ---------------------------------- App ---------------------------------- */

function loadCases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveCases(cases) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    return true;
  } catch (e) {
    return false;
  }
}

export default function App() {
  const [cases, setCases] = useState(null);
  const [sortMode, setSortMode] = useState("priority");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [toast, setToast] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimer = useRef(null);
  const didLoad = useRef(false);
  const cardRefs = useRef({});

  useEffect(() => {
    setCases(loadCases());
    didLoad.current = true;
  }, []);

  useEffect(() => {
    if (!didLoad.current || cases === null) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveCases(cases);
      setSaveStatus(ok ? "saved" : "error");
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [cases]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function updateCase(id, patch) {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteCase(id) {
    setCases((prev) => prev.filter((c) => c.id !== id));
    showToast("Case removed");
  }
  function addCase() {
    const c = makeCase();
    setCases((prev) => [...(prev || []), c]);
    setExpanded((prev) => ({ ...prev, [c.id]: true }));
    setTimeout(() => {
      cardRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function addFlow(caseId) {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, flows: [...c.flows, makeFlow()] } : c))
    );
  }
  function updateFlow(caseId, flowId, patch) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? { ...c, flows: c.flows.map((f) => (f.id === flowId ? { ...f, ...patch } : f)) }
          : c
      )
    );
  }
  function deleteFlow(caseId, flowId) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, flows: c.flows.filter((f) => f.id !== flowId) } : c
      )
    );
  }
  function addRow(caseId, flowId) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              flows: c.flows.map((f) =>
                f.id === flowId ? { ...f, rows: [...f.rows, makeRow()] } : f
              ),
            }
          : c
      )
    );
  }
  function updateRow(caseId, flowId, rowId, patch) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              flows: c.flows.map((f) =>
                f.id === flowId
                  ? { ...f, rows: f.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) }
                  : f
              ),
            }
          : c
      )
    );
  }
  function updateCell(caseId, flowId, rowId, speech, value) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              flows: c.flows.map((f) =>
                f.id === flowId
                  ? {
                      ...f,
                      rows: f.rows.map((r) =>
                        r.id === rowId ? { ...r, cells: { ...r.cells, [speech]: value } } : r
                      ),
                    }
                  : f
              ),
            }
          : c
      )
    );
  }
  function deleteRow(caseId, flowId, rowId) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              flows: c.flows.map((f) =>
                f.id === flowId ? { ...f, rows: f.rows.filter((r) => r.id !== rowId) } : f
              ),
            }
          : c
      )
    );
  }

  function exportFlow(caseName, flow) {
    const payload = {
      source: "case-prep-tracker",
      case: caseName || "Untitled case",
      flow: {
        title: flow.title,
        date: flow.date,
        speeches: SPEECHES,
        rows: flow.rows.map((r) => ({ label: r.label, cells: r.cells })),
      },
    };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => showToast("Flow copied — paste into GooseFlow or a doc"))
      .catch(() => showToast("Couldn't copy — try again"));
  }

  function clearAll() {
    if (window.confirm("Delete every case and flow? This can't be undone.")) {
      setCases([]);
      showToast("Cleared");
    }
  }

  const rootStyle = {
    minHeight: "100vh",
    width: "100%",
    background: "var(--cp-bg)",
    color: "var(--cp-text)",
    padding: "32px 20px 80px",
  };

  if (cases === null) {
    return (
      <div className="cp-root" style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "360px" }}>
        <StyleBlock />
        <p style={{ color: "var(--cp-muted)", fontFamily: "var(--cp-mono)", fontSize: 13 }}>
          Loading case list…
        </p>
      </div>
    );
  }

  const maxTeams = Math.max(1, ...cases.map((c) => c.teams.length));
  const filtered = cases.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.teams.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "priority") return b.teams.length - a.teams.length;
    if (sortMode === "strongest") return b.strength - a.strength;
    if (sortMode === "weakest") return a.strength - b.strength;
    return a.name.localeCompare(b.name);
  });

  const unprepped = cases.filter((c) => !c.docLink).length;

  return (
    <div className="cp-root" style={rootStyle}>
      <StyleBlock />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h1
              style={{
                fontFamily: "var(--cp-display)",
                fontWeight: 700,
                fontSize: 32,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              GooseBrief
            </h1>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-muted)" }}>
              {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : cases.length ? "Saved" : ""}
            </span>
          </div>
        </div>

        {/* Stats */}
        {cases.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              padding: "14px 18px",
              border: "1px solid var(--cp-border)",
              borderRadius: 10,
              background: "var(--cp-surface)",
              marginBottom: 20,
              fontFamily: "var(--cp-mono)",
              fontSize: 12,
            }}
          >
            <span><strong style={{ color: "var(--cp-text)" }}>{cases.length}</strong> <span style={{ color: "var(--cp-muted)" }}>cases tracked</span></span>
            <span><strong style={{ color: unprepped ? "var(--cp-bad)" : "var(--cp-good)" }}>{unprepped}</strong> <span style={{ color: "var(--cp-muted)" }}>without a brief</span></span>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--cp-border)",
              borderRadius: 8,
              padding: "8px 12px",
              flex: "1 1 200px",
              background: "var(--cp-surface)",
            }}
          >
            <Search size={14} color="var(--cp-muted)" />
            <input
              className="cp-input"
              placeholder="Search cases or teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            style={{
              background: "var(--cp-surface)",
              color: "var(--cp-text)",
              border: "1px solid var(--cp-border)",
              borderRadius: 8,
              padding: "9px 10px",
              fontFamily: "var(--cp-mono)",
              fontSize: 12,
              outline: "none",
            }}
          >
            <option value="priority">Sort: most teams running</option>
            <option value="strongest">Sort: strongest case first</option>
            <option value="weakest">Sort: weakest case first</option>
            <option value="name">Sort: name A–Z</option>
          </select>

          <button
            className="cp-btn"
            onClick={addCase}
            style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, borderColor: "var(--cp-accent)" }}
          >
            <Plus size={15} /> Add case
          </button>
        </div>

        {/* Empty state */}
        {cases.length === 0 && (
          <div
            style={{
              border: "1px dashed var(--cp-border)",
              borderRadius: 10,
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--cp-muted)",
            }}
          >
            <p style={{ marginBottom: 16, fontSize: 14 }}>No cases logged yet.</p>
            <button className="cp-btn" onClick={addCase} style={{ padding: "9px 16px", fontSize: 13, margin: "0 auto" }}>
              <Plus size={15} /> Log your first case
            </button>
          </div>
        )}

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((c, i) => (
            <CaseCard
              key={c.id}
              rank={i + 1}
              c={c}
              maxTeams={maxTeams}
              isExpanded={!!expanded[c.id]}
              onToggle={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}
              onUpdate={(patch) => updateCase(c.id, patch)}
              onDelete={() => deleteCase(c.id)}
              onAddFlow={() => addFlow(c.id)}
              onUpdateFlow={(flowId, patch) => updateFlow(c.id, flowId, patch)}
              onDeleteFlow={(flowId) => deleteFlow(c.id, flowId)}
              onAddRow={(flowId) => addRow(c.id, flowId)}
              onUpdateRow={(flowId, rowId, patch) => updateRow(c.id, flowId, rowId, patch)}
              onUpdateCell={(flowId, rowId, speech, val) => updateCell(c.id, flowId, rowId, speech, val)}
              onDeleteRow={(flowId, rowId) => deleteRow(c.id, flowId, rowId)}
              onExportFlow={(flow) => exportFlow(c.name, flow)}
              cardRef={(el) => (cardRefs.current[c.id] = el)}
            />
          ))}
        </div>

        {cases.length > 0 && (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <button
              onClick={clearAll}
              style={{
                background: "none",
                border: "none",
                color: "var(--cp-muted)",
                fontFamily: "var(--cp-mono)",
                fontSize: 11,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear all data
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--cp-surface2)",
            border: "1px solid var(--cp-accent)",
            color: "var(--cp-text)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "var(--cp-body)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Case Card ------------------------------- */

function CaseCard({
  rank,
  c,
  maxTeams,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onAddFlow,
  onUpdateFlow,
  onDeleteFlow,
  onAddRow,
  onUpdateRow,
  onUpdateCell,
  onDeleteRow,
  onExportFlow,
  cardRef,
}) {
  const [teamDraft, setTeamDraft] = useState("");
  const meta = STRENGTH_META[c.strength] || STRENGTH_META[3];
  const pressure = Math.round((c.teams.length / maxTeams) * 100);

  function commitTeam() {
    const v = teamDraft.trim();
    if (v) onUpdate({ teams: [...c.teams, v] });
    setTeamDraft("");
  }
  function removeTeam(idx) {
    onUpdate({ teams: c.teams.filter((_, i) => i !== idx) });
  }

  return (
    <div className="cp-card" ref={cardRef} style={{ padding: 16 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--cp-mono)",
            fontSize: 13,
            color: "var(--cp-muted)",
            paddingTop: 3,
            minWidth: 22,
          }}
        >
          {String(rank).padStart(2, "0")}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="cp-input"
            placeholder="e.g. Space Militarization Aff"
            defaultValue={c.name}
            onBlur={(e) => onUpdate({ name: e.target.value })}
            style={{ fontFamily: "var(--cp-display)", fontWeight: 600, fontSize: 17 }}
          />

          {/* pressure bar */}
          <div style={{ height: 5, background: "var(--cp-border)", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pressure}%`, background: "var(--cp-accent)", transition: "width 0.2s ease" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-muted)" }}>
              {c.teams.length} {c.teams.length === 1 ? "team" : "teams"} running this
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={meta.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className="cp-pip"
                  onClick={() => onUpdate({ strength: n })}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: n <= c.strength ? meta.color : "var(--cp-border)",
                    display: "inline-block",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {c.docLink ? (
          <a
            href={c.docLink}
            target="_blank"
            rel="noopener noreferrer"
            className="cp-btn-icon"
            style={{ padding: 6 }}
            title="Open neg brief doc"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={15} />
          </a>
        ) : null}
        <button className="cp-btn-icon" onClick={onToggle} style={{ padding: 6 }}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button className="cp-btn-icon" onClick={onDelete} style={{ padding: 6 }}>
          <Trash2 size={15} />
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--cp-border)" }}>
          {/* Teams */}
          <div style={{ marginBottom: 14 }}>
            <Label>Teams running it</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
              {c.teams.map((t, idx) => (
                <span key={idx} className="cp-tag" style={{ padding: "4px 10px" }}>
                  {t}
                  <X size={11} style={{ cursor: "pointer" }} onClick={() => removeTeam(idx)} />
                </span>
              ))}
              <input
                className="cp-input"
                placeholder="+ add team, Enter"
                value={teamDraft}
                onChange={(e) => setTeamDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTeam();
                  }
                }}
                style={{ width: 140, fontSize: 12, fontFamily: "var(--cp-mono)" }}
              />
            </div>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ flex: "1 1 260px" }}>
              <Label>Neg brief doc</Label>
              <LinkRow value={c.docLink} onCommit={(v) => onUpdate({ docLink: v })} placeholder="Paste Google Doc link" />
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <Label>GooseFlow link</Label>
              <LinkRow value={c.gooseflowLink} onCommit={(v) => onUpdate({ gooseflowLink: v })} placeholder="Paste GooseFlow round link" />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <Label>Notes</Label>
            <textarea
              className="cp-input"
              defaultValue={c.notes}
              onBlur={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Weighing strategy, judge notes, anything worth remembering…"
              rows={2}
              style={{ fontSize: 13, marginTop: 4, resize: "vertical" }}
            />
          </div>

          {/* Flows */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Label>Flows against this case ({c.flows.length})</Label>
              <button className="cp-btn" onClick={onAddFlow} style={{ padding: "5px 10px", fontSize: 11 }}>
                <Plus size={12} /> Add flow
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {c.flows.map((f) => (
                <FlowBlock
                  key={f.id}
                  flow={f}
                  onUpdate={(patch) => onUpdateFlow(f.id, patch)}
                  onDelete={() => onDeleteFlow(f.id)}
                  onAddRow={() => onAddRow(f.id)}
                  onUpdateRow={(rowId, patch) => onUpdateRow(f.id, rowId, patch)}
                  onUpdateCell={(rowId, speech, val) => onUpdateCell(f.id, rowId, speech, val)}
                  onDeleteRow={(rowId) => onDeleteRow(f.id, rowId)}
                  onExport={() => onExportFlow(f)}
                />
              ))}
              {c.flows.length === 0 && (
                <p style={{ color: "var(--cp-muted)", fontSize: 12, fontFamily: "var(--cp-mono)" }}>
                  No flows logged against this case yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontFamily: "var(--cp-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--cp-muted)",
      }}
    >
      {children}
    </div>
  );
}

function LinkRow({ value, onCommit, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
      <input
        className="cp-input"
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: 12 }}
      />
      {value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="cp-btn-icon" style={{ padding: 5 }}>
          <ExternalLink size={13} />
        </a>
      ) : null}
    </div>
  );
}

/* -------------------------------- Flow block ------------------------------- */

function FlowBlock({ flow, onUpdate, onDelete, onAddRow, onUpdateRow, onUpdateCell, onDeleteRow, onExport }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid var(--cp-border)", borderRadius: 8, background: "var(--cp-surface2)", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button className="cp-btn-icon" onClick={() => setOpen((o) => !o)} style={{ padding: 4 }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <input
          className="cp-input"
          defaultValue={flow.title}
          onBlur={(e) => onUpdate({ title: e.target.value })}
          style={{ fontWeight: 600, fontSize: 13, flex: "1 1 140px" }}
        />
        <input
          type="date"
          value={flow.date}
          onChange={(e) => onUpdate({ date: e.target.value })}
          style={{
            background: "var(--cp-surface)",
            border: "1px solid var(--cp-border)",
            color: "var(--cp-muted)",
            borderRadius: 6,
            fontFamily: "var(--cp-mono)",
            fontSize: 11,
            padding: "4px 6px",
          }}
        />
        <button className="cp-btn-icon" onClick={onExport} title="Copy flow as JSON">
          <Copy size={13} />
        </button>
        <button className="cp-btn-icon" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="cp-scroll" style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Arg</th>
                  {SPEECHES.map((s) => (
                    <th key={s} style={thStyle}>{s}</th>
                  ))}
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {flow.rows.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      <input
                        className="cp-input"
                        defaultValue={r.label}
                        onBlur={(e) => onUpdateRow(r.id, { label: e.target.value })}
                        placeholder="argument"
                        style={{ fontSize: 11, fontFamily: "var(--cp-mono)", width: 110 }}
                      />
                    </td>
                    {SPEECHES.map((s) => (
                      <td key={s} style={tdStyle}>
                        <textarea
                          className="cp-textarea"
                          defaultValue={r.cells[s]}
                          onBlur={(e) => onUpdateCell(r.id, s, e.target.value)}
                          rows={2}
                          style={{ width: 100, padding: 6 }}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button className="cp-btn-icon" onClick={() => onDeleteRow(r.id)} style={{ padding: 4 }}>
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="cp-btn" onClick={onAddRow} style={{ padding: "5px 10px", fontSize: 11, marginTop: 8 }}>
            <Plus size={12} /> Add row
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  fontFamily: "var(--cp-mono)",
  fontSize: 10,
  color: "var(--cp-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "4px 6px",
  borderBottom: "1px solid var(--cp-border)",
};
const tdStyle = {
  padding: "4px 6px",
  verticalAlign: "top",
};
