import { useState, useEffect, useRef } from "react";
import { ref, onValue, set as dbSet } from "firebase/database";
import { db, authReady } from "./firebase.js";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { uid } from "./utils.js";
import {
  FlowBoard,
  SPEECH_DEFS,
  makeFlowSpeeches,
  normalizeFlowSpeeches,
  normalizeFlowConnections,
} from "./FlowBoard.jsx";

// Shared team passcode. This is a friction layer, not real security — the
// database itself is still open to anyone who has the URL. Change this to
// whatever your team wants before you share the link.
const TEAM_PASSCODE = "goosebrief2026";
const GATE_KEY = "gb-unlocked";

function makeFlow() {
  return {
    id: uid(),
    title: "new flow",
    date: new Date().toISOString().slice(0, 10),
    speeches: makeFlowSpeeches(),
    connections: [],
  };
}

function makeCase() {
  return {
    id: uid(),
    name: "",
    teams: [],
    strength: 3,
    docLink: "",
    notes: "",
    flows: [],
    createdAt: Date.now(),
  };
}

const STRENGTH_META = {
  1: { label: "weak — beat it easily", color: "#5FA88F" },
  2: { label: "manageable", color: "#7FAE87" },
  3: { label: "even matchup", color: "#D4A054" },
  4: { label: "strong — needs real prep", color: "#C97A4A" },
  5: { label: "very strong — biggest threat", color: "#C1584A" },
};

/* ---------------------------------- Style ---------------------------------- */

function StyleBlock() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

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
        --cp-aff: #5fa88f;
        --cp-neg: #6f93c9;
        --cp-display: 'Space Grotesk', sans-serif;
        --cp-body: 'Inter', sans-serif;
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
      .cp-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--cp-surface2);
        border: 1px solid var(--cp-border);
        border-radius: 999px;
        font-size: 12px;
        color: var(--cp-text);
      }
      .cp-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .cp-scroll::-webkit-scrollbar-thumb { background: var(--cp-border); border-radius: 4px; }
      .cp-scroll::-webkit-scrollbar-track { background: transparent; }

      /* Flow board (embedded gooseflow) */
      .cp-flow-col {
        min-width: 220px;
        max-width: 260px;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px 10px 10px 4px;
        border-radius: 8px;
        transition: background 0.15s ease;
        position: relative;
      }
      .cp-flow-col.hovered { background: rgba(255,255,255,0.03); }
      .cp-flow-col-header {
        font-family: var(--cp-body);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.02em;
        padding: 3px 4px 6px;
        border-bottom: 1px solid var(--cp-border);
        position: sticky;
        top: 0;
        background: var(--cp-bg);
        z-index: 3;
      }
      .cp-flow-col-header.aff { color: var(--cp-aff); }
      .cp-flow-col-header.neg { color: var(--cp-neg); }
      .cp-flow-cells { display: flex; flex-direction: column; gap: 8px; margin-left: 10px; padding-bottom: 8px; }
      .cp-flow-item-wrap { cursor: grab; user-select: none; touch-action: none; border-radius: 6px; }
      .cp-flow-item-wrap:active { cursor: grabbing; }
      .cp-flow-cell {
        background: var(--cp-surface2);
        border: 1px solid var(--cp-border);
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 7px 9px 7px 5px;
        position: relative;
        transition: border-color 0.15s ease;
      }
      .cp-flow-cell:hover { border-color: var(--cp-accent); }
      .cp-flow-cell.aff { border-left: 2px solid var(--cp-aff); }
      .cp-flow-cell.neg { border-left: 2px solid var(--cp-neg); }
      .cp-flow-cell.selected { border-color: var(--cp-accent) !important; box-shadow: 0 0 0 1px var(--cp-accent); background: #241c0c; }
      .cp-flow-grip {
        display: flex;
        align-items: center;
        color: var(--cp-muted);
        opacity: 0;
        cursor: grab;
        margin-top: 2px;
        transition: opacity 0.15s ease;
      }
      .cp-flow-cell:hover .cp-flow-grip { opacity: 1; }
      .cp-flow-textarea-wrap { flex: 1; position: relative; min-height: 28px; }
      .cp-flow-textarea {
        width: 100%;
        min-height: 28px;
        line-height: 1.45;
        font-size: 11.5px;
        font-family: var(--cp-body);
        background: transparent;
        border: none;
        outline: none;
        color: var(--cp-text);
        resize: none;
        overflow: hidden;
        position: relative;
        z-index: 2;
      }
      .cp-flow-textarea::placeholder { color: var(--cp-muted); }
      .cp-flow-textarea.tagged { color: transparent !important; caret-color: var(--cp-text) !important; }
      .cp-flow-tag-overlay {
        position: absolute;
        inset: 0;
        z-index: 1;
        font-family: var(--cp-body);
        font-size: 11.5px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
        pointer-events: none;
      }
      .cp-flow-space { height: 16px; background: transparent; cursor: grab; }
      .cp-flow-placeholder {
        background: var(--cp-surface2);
        border: 1px dashed var(--cp-border);
        border-radius: 6px;
        padding: 5px 7px;
        min-height: 28px;
        opacity: 0.35;
        display: flex;
        align-items: flex-start;
      }
      .cp-flow-placeholder.space { min-height: 16px; padding: 0; }
      .cp-flow-placeholder-text {
        font-family: var(--cp-body);
        font-size: 11.5px;
        color: var(--cp-muted);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .cp-flow-floating {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        background: var(--cp-surface2);
        border: 1px solid var(--cp-accent);
        border-radius: 6px;
        padding: 5px 7px;
        min-height: 28px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        opacity: 0.95;
        font-family: var(--cp-body);
        font-size: 11.5px;
        color: var(--cp-text);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .cp-flow-floating.space { min-height: 16px; padding: 0; opacity: 0.7; }
      .cp-flow-addcell {
        font-family: var(--cp-body);
        font-size: 10px;
        padding: 4px;
        border: 1px dashed var(--cp-border);
        border-radius: 6px;
        color: var(--cp-muted);
        background: transparent;
        text-align: center;
        transition: all 0.15s ease;
        margin-top: 2px;
        cursor: pointer;
      }
      .cp-flow-addcell:hover { color: var(--cp-text); border-color: var(--cp-accent); background: var(--cp-surface2); }
      .cp-flow-hint {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--cp-surface2);
        border: 1px solid var(--cp-border);
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 10px;
        font-family: var(--cp-body);
        color: var(--cp-muted);
        pointer-events: none;
        z-index: 20;
        white-space: nowrap;
        max-width: calc(100% - 24px);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-flow-hint.active { border-color: var(--cp-accent); color: var(--cp-text); }
      .cp-flow-help-btn {
        width: 20px;
        height: 20px;
        font-size: 11px;
        font-family: var(--cp-body);
        color: var(--cp-muted);
        border: 1px solid var(--cp-border);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        flex-shrink: 0;
        background: var(--cp-bg);
      }
      .cp-flow-help-btn:hover { color: var(--cp-text); border-color: var(--cp-accent); }

      /* Native date input calendar icon is nearly invisible on a dark
         background by default — force it to render light and full-opacity. */
      .cp-date-input { color-scheme: dark; }
      .cp-date-input::-webkit-calendar-picker-indicator {
        filter: invert(1) brightness(1.8);
        opacity: 1;
        cursor: pointer;
        border-radius: 3px;
        padding: 2px;
      }
      .cp-date-input::-webkit-calendar-picker-indicator:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    `}</style>
  );
}

/* ---------------------------------- App ---------------------------------- */

const casesRootRef = ref(db, "casesById");

// Firebase Realtime Database silently drops empty arrays/objects and can
// reshape arrays into keyed objects. Storing each case as a JSON string
// value sidesteps all of that — it's just a blob to Firebase either way.
function normalizeCase(c) {
  return {
    id: c?.id || uid(),
    name: c?.name || "",
    teams: Array.isArray(c?.teams) ? c.teams : [],
    strength: typeof c?.strength === "number" ? c.strength : 3,
    docLink: c?.docLink || "",
    notes: c?.notes || "",
    flows: Array.isArray(c?.flows) ? c.flows.map(normalizeFlow) : [],
    createdAt: typeof c?.createdAt === "number" ? c.createdAt : 0,
  };
}

// Handles both the current flow shape (full flow-board speeches/connections)
// and the old simple row-per-argument shape from before gooseflow was
// embedded directly — old rows get folded into their matching speech
// columns so existing cases don't lose prep work.
function normalizeFlow(f) {
  const id = f?.id || uid();
  const title = f?.title || "untitled flow";
  const date = f?.date || new Date().toISOString().slice(0, 10);

  if (Array.isArray(f?.speeches)) {
    return {
      id,
      title,
      date,
      speeches: normalizeFlowSpeeches(f.speeches),
      connections: normalizeFlowConnections(f.connections),
    };
  }

  // Legacy migration: each old row had one text cell per speech label.
  // Every non-empty (label, speech) pair becomes its own argument cell
  // in that speech's column.
  const legacyRows = Array.isArray(f?.rows) ? f.rows : [];
  const speeches = SPEECH_DEFS.map((def) => {
    const items = [];
    legacyRows.forEach((r) => {
      const val = r?.cells?.[def.label];
      if (val && val.trim()) {
        const content = r?.label ? `${r.label}: ${val}` : val;
        items.push({ id: uid(), type: "cell", content });
      }
    });
    if (items.length === 0) items.push({ id: `${def.id}-${uid()}`, type: "cell", content: "" });
    return { ...def, items };
  });

  return { id, title, date, speeches, connections: [] };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(GATE_KEY) === "1";
    } catch (e) {
      return false;
    }
  });
  const [cases, setCases] = useState(null);
  const [sortMode, setSortMode] = useState("priority");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [toast, setToast] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const writeTimers = useRef({}); // caseId -> timeout, so editing one case
  // never delays or gets coalesced with edits to a different case
  const pendingWrites = useRef(0);
  const cardRefs = useRef({});

  useEffect(() => {
    let unsubscribe = () => {};
    authReady
      .then(() => {
        unsubscribe = onValue(
          casesRootRef,
          (snapshot) => {
            const obj = snapshot.val() || {};
            const list = Object.values(obj).map((raw) => {
              try {
                return normalizeCase(JSON.parse(raw));
              } catch (e) {
                return null;
              }
            }).filter(Boolean);
            list.sort((a, b) => a.createdAt - b.createdAt);
            setCases(list);
          },
          (err) => {
            console.error("goosebrief read failed:", err);
            setCases([]);
          }
        );
      })
      .catch((err) => {
        console.error("goosebrief auth failed:", err);
        setCases([]);
      });
    return () => unsubscribe();
  }, []);

  // Writes only the one case that changed, to its own Firebase key, so
  // editing case A can never overwrite a concurrent edit to case B.
  function scheduleWrite(caseObj) {
    const id = caseObj.id;
    if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
    pendingWrites.current += 1;
    setSaveStatus("saving");
    writeTimers.current[id] = setTimeout(async () => {
      try {
        await dbSet(ref(db, `casesById/${id}`), JSON.stringify(caseObj));
      } catch (e) {
        console.error("goosebrief save failed:", e);
        showToast(`save failed: ${e.code || e.message || "unknown error"}`);
      } finally {
        pendingWrites.current -= 1;
        setSaveStatus(pendingWrites.current <= 0 ? "saved" : "saving");
      }
    }, 300);
  }

  // Applies an updater to one case in local state, and schedules a write
  // of just that case's new value.
  function mutateCase(id, updater) {
    setCases((prev) => {
      const next = prev.map((c) => (c.id === id ? updater(c) : c));
      const changed = next.find((c) => c.id === id);
      if (changed) scheduleWrite(changed);
      return next;
    });
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function updateCase(id, patch) {
    mutateCase(id, (c) => ({ ...c, ...patch }));
  }
  function deleteCase(id) {
    const target = cases.find((c) => c.id === id);
    const label = target?.name?.trim() ? `"${target.name.trim()}"` : "this case";
    if (!window.confirm(`delete ${label} for everyone? this can't be undone.`)) return;
    if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
    setCases((prev) => prev.filter((c) => c.id !== id));
    dbSet(ref(db, `casesById/${id}`), null).catch((e) => {
      console.error("goosebrief delete failed:", e);
      showToast(`delete failed: ${e.code || e.message || "unknown error"}`);
    });
    showToast("case removed");
  }
  function addCase() {
    const c = makeCase();
    setCases((prev) => [...(prev || []), c]);
    scheduleWrite(c);
    setExpanded((prev) => ({ ...prev, [c.id]: true }));
    setTimeout(() => {
      cardRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function addFlow(caseId) {
    mutateCase(caseId, (c) => ({ ...c, flows: [...c.flows, makeFlow()] }));
  }
  function updateFlow(caseId, flowId, patch) {
    mutateCase(caseId, (c) => ({
      ...c,
      flows: c.flows.map((f) => (f.id === flowId ? { ...f, ...patch } : f)),
    }));
  }
  function deleteFlow(caseId, flowId) {
    mutateCase(caseId, (c) => ({ ...c, flows: c.flows.filter((f) => f.id !== flowId) }));
  }
  // --- Flow-board mutations (the embedded gooseflow board) ---
  // All scoped to a single (caseId, flowId, speechId) path within the
  // case tree, following the same mutateCase → debounced Firebase write
  // pattern as the rest of the app.
  function mapFlowSpeeches(caseId, flowId, speechId, fn) {
    mutateCase(caseId, (c) => ({
      ...c,
      flows: c.flows.map((f) =>
        f.id !== flowId
          ? f
          : { ...f, speeches: f.speeches.map((s) => (s.id !== speechId ? s : fn(s))) }
      ),
    }));
  }

  function addCellToSpeech(caseId, flowId, speechId) {
    mapFlowSpeeches(caseId, flowId, speechId, (s) => ({
      ...s,
      items: [...s.items, { id: `${speechId}-${uid()}`, type: "cell", content: "" }],
    }));
  }

  // Generates the new cell's id up front (not inside setState) so the
  // caller can focus it immediately, same pattern gooseflow used.
  function addCellAfterInSpeech(caseId, flowId, speechId, afterCellId) {
    const newId = `${speechId}-${uid()}`;
    mapFlowSpeeches(caseId, flowId, speechId, (s) => {
      const idx = s.items.findIndex((it) => it.id === afterCellId);
      const newCell = { id: newId, type: "cell", content: "" };
      if (idx === -1) return { ...s, items: [...s.items, newCell] };
      const items = [...s.items];
      items.splice(idx + 1, 0, newCell);
      return { ...s, items };
    });
    return newId;
  }

  function deleteCellFromSpeech(caseId, flowId, speechId, cellId) {
    mutateCase(caseId, (c) => ({
      ...c,
      flows: c.flows.map((f) => {
        if (f.id !== flowId) return f;
        return {
          ...f,
          connections: f.connections.filter((cn) => cn.fromCellId !== cellId && cn.toCellId !== cellId),
          speeches: f.speeches.map((s) => {
            if (s.id !== speechId) return s;
            const cellCount = s.items.filter((it) => it.type === "cell").length;
            if (cellCount <= 1) {
              // Never leave a column with zero cells — clear it instead.
              return {
                ...s,
                items: s.items.map((it) =>
                  it.id === cellId ? { id: `${speechId}-${uid()}`, type: "cell", content: "" } : it
                ),
              };
            }
            return { ...s, items: s.items.filter((it) => it.id !== cellId) };
          }),
        };
      }),
    }));
  }

  function addEmptySpaceToSpeech(caseId, flowId, speechId) {
    mapFlowSpeeches(caseId, flowId, speechId, (s) => ({
      ...s,
      items: [...s.items, { id: `${speechId}-space-${uid()}`, type: "space" }],
    }));
  }

  function deleteEmptySpaceFromSpeech(caseId, flowId, speechId, spaceId) {
    mapFlowSpeeches(caseId, flowId, speechId, (s) => ({
      ...s,
      items: s.items.filter((it) => it.id !== spaceId),
    }));
  }

  function reorderSpeechItems(caseId, flowId, speechId, newItems) {
    mapFlowSpeeches(caseId, flowId, speechId, (s) => ({ ...s, items: newItems }));
  }

  function updateCellContent(caseId, flowId, speechId, cellId, content) {
    mapFlowSpeeches(caseId, flowId, speechId, (s) => ({
      ...s,
      items: s.items.map((it) => (it.id === cellId ? { ...it, content } : it)),
    }));
  }

  function addFlowConnection(caseId, flowId, fromCellId, toCellId) {
    mutateCase(caseId, (c) => ({
      ...c,
      flows: c.flows.map((f) => {
        if (f.id !== flowId) return f;
        if (f.connections.some((cn) => cn.fromCellId === fromCellId && cn.toCellId === toCellId)) return f;
        return { ...f, connections: [...f.connections, { id: uid(), fromCellId, toCellId }] };
      }),
    }));
  }

  function removeFlowConnection(caseId, flowId, connId) {
    mutateCase(caseId, (c) => ({
      ...c,
      flows: c.flows.map((f) => (f.id !== flowId ? f : { ...f, connections: f.connections.filter((cn) => cn.id !== connId) })),
    }));
  }

  function clearAll() {
    if (window.confirm("delete every case and flow for everyone? this can't be undone.")) {
      Object.values(writeTimers.current).forEach(clearTimeout);
      writeTimers.current = {};
      setCases([]);
      dbSet(casesRootRef, null).catch((e) => {
        console.error("goosebrief clear failed:", e);
        showToast(`clear failed: ${e.code || e.message || "unknown error"}`);
      });
      showToast("cleared");
    }
  }

  const rootStyle = {
    minHeight: "100vh",
    width: "100%",
    background: "var(--cp-bg)",
    color: "var(--cp-text)",
    padding: "32px 20px 80px",
  };

  if (!unlocked) {
    return <Gate onUnlock={() => setUnlocked(true)} rootStyle={rootStyle} />;
  }

  if (cases === null) {
    return (
      <div className="cp-root" style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "360px" }}>
        <StyleBlock />
        <p style={{ color: "var(--cp-muted)", fontFamily: "var(--cp-body)", fontSize: 13 }}>
          loading case list…
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
              goosebrief
            </h1>
            <span style={{ fontFamily: "var(--cp-body)", fontSize: 11, color: "var(--cp-muted)" }}>
              {saveStatus === "saving" ? "saving…" : saveStatus === "error" ? "save failed" : cases.length ? "saved" : ""}
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
              fontFamily: "var(--cp-body)",
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
              placeholder="search cases or teams…"
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
              fontFamily: "var(--cp-body)",
              fontSize: 12,
              outline: "none",
            }}
          >
            <option value="priority">sort: most teams running</option>
            <option value="strongest">sort: strongest case first</option>
            <option value="weakest">sort: weakest case first</option>
            <option value="name">sort: name a–z</option>
          </select>

          <button
            className="cp-btn"
            onClick={addCase}
            style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, borderColor: "var(--cp-accent)" }}
          >
            <Plus size={15} /> add case
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
            <p style={{ marginBottom: 16, fontSize: 14 }}>no cases logged yet.</p>
            <button className="cp-btn" onClick={addCase} style={{ padding: "9px 16px", fontSize: 13, margin: "0 auto" }}>
              <Plus size={15} /> log your first case
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
              onAddCell={(flowId, speechId) => addCellToSpeech(c.id, flowId, speechId)}
              onAddCellAfter={(flowId, speechId, cellId) => addCellAfterInSpeech(c.id, flowId, speechId, cellId)}
              onDeleteCell={(flowId, speechId, cellId) => deleteCellFromSpeech(c.id, flowId, speechId, cellId)}
              onAddEmptySpace={(flowId, speechId) => addEmptySpaceToSpeech(c.id, flowId, speechId)}
              onDeleteEmptySpace={(flowId, speechId, spaceId) => deleteEmptySpaceFromSpeech(c.id, flowId, speechId, spaceId)}
              onReorderItems={(flowId, speechId, items) => reorderSpeechItems(c.id, flowId, speechId, items)}
              onUpdateCellContent={(flowId, speechId, cellId, content) => updateCellContent(c.id, flowId, speechId, cellId, content)}
              onAddConnection={(flowId, fromCellId, toCellId) => addFlowConnection(c.id, flowId, fromCellId, toCellId)}
              onRemoveConnection={(flowId, connId) => removeFlowConnection(c.id, flowId, connId)}
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
                fontFamily: "var(--cp-body)",
                fontSize: 11,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              clear all data
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

/* ---------------------------------- Gate ---------------------------------- */

function Gate({ onUnlock, rootStyle }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit() {
    if (value.trim().toLowerCase() === TEAM_PASSCODE.trim().toLowerCase()) {
      try {
        localStorage.setItem(GATE_KEY, "1");
      } catch (e) {
        /* ignore */
      }
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <div
      className="cp-root"
      style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}
    >
      <StyleBlock />
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          border: "1px solid var(--cp-border)",
          background: "var(--cp-surface)",
          borderRadius: 10,
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--cp-display)",
            fontWeight: 700,
            fontSize: 22,
            margin: "0 0 16px",
          }}
        >
          goosebrief
        </h1>
        <input
          className="cp-input"
          type="password"
          autoFocus
          placeholder="team passcode"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            fontFamily: "var(--cp-body)",
            fontSize: 13,
            textAlign: "center",
            border: `1px solid ${error ? "var(--cp-bad)" : "var(--cp-border)"}`,
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 12,
          }}
        />
        <button
          className="cp-btn"
          onClick={submit}
          style={{ width: "100%", justifyContent: "center", padding: "9px 0", fontSize: 13, fontWeight: 600 }}
        >
          unlock
        </button>
        {error && (
          <p style={{ color: "var(--cp-bad)", fontSize: 11, fontFamily: "var(--cp-body)", marginTop: 10 }}>
            wrong passcode
          </p>
        )}
      </div>
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
  onAddCell,
  onAddCellAfter,
  onDeleteCell,
  onAddEmptySpace,
  onDeleteEmptySpace,
  onReorderItems,
  onUpdateCellContent,
  onAddConnection,
  onRemoveConnection,
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
            fontFamily: "var(--cp-body)",
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
            placeholder="untitled case"
            defaultValue={c.name}
            onBlur={(e) => onUpdate({ name: e.target.value })}
            style={{ fontFamily: "var(--cp-display)", fontWeight: 600, fontSize: 17 }}
          />

          {/* pressure bar */}
          <div style={{ height: 5, background: "var(--cp-border)", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pressure}%`, background: "var(--cp-accent)", transition: "width 0.2s ease" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontFamily: "var(--cp-body)", fontSize: 11, color: "var(--cp-muted)" }}>
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
            title="open neg brief doc"
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
            <Label>teams running it</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
              {c.teams.map((t, idx) => (
                <span key={idx} className="cp-tag" style={{ padding: "4px 10px" }}>
                  {t}
                  <X size={11} style={{ cursor: "pointer" }} onClick={() => removeTeam(idx)} />
                </span>
              ))}
              <input
                className="cp-input"
                placeholder="+ add team, enter"
                value={teamDraft}
                onChange={(e) => setTeamDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTeam();
                  }
                }}
                style={{ width: 140, fontSize: 12, fontFamily: "var(--cp-body)" }}
              />
            </div>
          </div>

          {/* Links */}
          <div style={{ marginBottom: 14 }}>
            <Label>neg brief doc</Label>
            <LinkRow value={c.docLink} onCommit={(v) => onUpdate({ docLink: v })} placeholder="paste google doc link" />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <Label>notes</Label>
            <textarea
              className="cp-input"
              defaultValue={c.notes}
              onBlur={(e) => onUpdate({ notes: e.target.value })}
              placeholder="weighing strategy, judge notes, anything worth remembering…"
              rows={2}
              style={{ fontSize: 13, marginTop: 4, resize: "vertical" }}
            />
          </div>

          {/* Flows */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Label>flows against this case ({c.flows.length})</Label>
              <button className="cp-btn" onClick={onAddFlow} style={{ padding: "5px 10px", fontSize: 11 }}>
                <Plus size={12} /> add flow
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {c.flows.map((f) => (
                <FlowBlock
                  key={f.id}
                  flow={f}
                  onUpdate={(patch) => onUpdateFlow(f.id, patch)}
                  onDelete={() => onDeleteFlow(f.id)}
                  onAddCell={(speechId) => onAddCell(f.id, speechId)}
                  onAddCellAfter={(speechId, cellId) => onAddCellAfter(f.id, speechId, cellId)}
                  onDeleteCell={(speechId, cellId) => onDeleteCell(f.id, speechId, cellId)}
                  onAddEmptySpace={(speechId) => onAddEmptySpace(f.id, speechId)}
                  onDeleteEmptySpace={(speechId, spaceId) => onDeleteEmptySpace(f.id, speechId, spaceId)}
                  onReorderItems={(speechId, items) => onReorderItems(f.id, speechId, items)}
                  onUpdateCellContent={(speechId, cellId, content) => onUpdateCellContent(f.id, speechId, cellId, content)}
                  onAddConnection={(fromCellId, toCellId) => onAddConnection(f.id, fromCellId, toCellId)}
                  onRemoveConnection={(connId) => onRemoveConnection(f.id, connId)}
                />
              ))}
              {c.flows.length === 0 && (
                <p style={{ color: "var(--cp-muted)", fontSize: 12, fontFamily: "var(--cp-body)" }}>
                  no flows logged against this case yet.
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
        fontFamily: "var(--cp-body)",
        fontSize: 10,
        letterSpacing: "0.08em",
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

function FlowBlock({
  flow, onUpdate, onDelete,
  onAddCell, onAddCellAfter, onDeleteCell,
  onAddEmptySpace, onDeleteEmptySpace,
  onReorderItems, onUpdateCellContent,
  onAddConnection, onRemoveConnection,
}) {
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
          className="cp-date-input"
          value={flow.date}
          onChange={(e) => onUpdate({ date: e.target.value })}
          style={{
            background: "var(--cp-surface)",
            border: "1px solid var(--cp-border)",
            color: "var(--cp-muted)",
            borderRadius: 6,
            fontFamily: "var(--cp-body)",
            fontSize: 11,
            padding: "4px 6px",
          }}
        />
        <button className="cp-btn-icon" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <FlowBoard
            flow={flow}
            onAddCell={onAddCell}
            onAddCellAfter={onAddCellAfter}
            onDeleteCell={onDeleteCell}
            onAddEmptySpace={onAddEmptySpace}
            onDeleteEmptySpace={onDeleteEmptySpace}
            onReorderItems={onReorderItems}
            onUpdateCellContent={onUpdateCellContent}
            onAddConnection={onAddConnection}
            onRemoveConnection={onRemoveConnection}
          />
        </div>
      )}
    </div>
  );
}
