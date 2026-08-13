import { useState, useEffect, useRef } from "react";
import { ref, get, onValue, set as dbSet } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth, signInWithGoogle, signOutOfGoogle } from "./firebase.js";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  Search,
  Users,
  LogOut,
  Copy,
  RefreshCw,
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
import {
  createCaselist,
  joinCaselist,
  leaveCaselist,
  removeMember,
  regenerateJoinCode,
  importLegacyCases,
} from "./caselist.js";

// Which caselist this browser was last looking at, so returning users land
// back where they were instead of re-picking every visit.
const ACTIVE_CASELIST_KEY = "gb-active-caselist";

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
  // undefined = auth state still loading, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  // null = still loading; object keyed by caselistId once loaded
  const [myCaselists, setMyCaselists] = useState(null);
  const [activeCaselistId, setActiveCaselistId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_CASELIST_KEY) || null;
    } catch (e) {
      return null;
    }
  });
  const [caselistMeta, setCaselistMeta] = useState(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);

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

  // --- Auth state ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- Which caselists this signed-in user belongs to ---
  useEffect(() => {
    if (!user) {
      setMyCaselists(null);
      return;
    }
    const r = ref(db, `userCaselists/${user.uid}`);
    const unsubscribe = onValue(
      r,
      (snap) => setMyCaselists(snap.val() || {}),
      () => setMyCaselists({})
    );
    return () => unsubscribe();
  }, [user]);

  // Auto-select the active caselist once we know the list, but only ever
  // to fill in a *missing* choice (nothing remembered, or exactly one
  // caselist to begin with). We deliberately never demote an
  // already-set activeCaselistId here — right after creating or joining a
  // caselist, this list can still be one render behind the write that
  // just happened, and treating that lag as "invalid" would bounce the
  // person straight back to the picker. Genuine loss of access (kicked,
  // left) is instead caught for real by handleLostAccess below, which
  // reacts to an actual permission-denied read rather than racing local
  // state.
  useEffect(() => {
    if (!myCaselists || activeCaselistId) return;
    const ids = Object.keys(myCaselists);
    if (ids.length === 1) setActiveCaselistId(ids[0]);
  }, [myCaselists, activeCaselistId]);

  useEffect(() => {
    try {
      if (activeCaselistId) localStorage.setItem(ACTIVE_CASELIST_KEY, activeCaselistId);
      else localStorage.removeItem(ACTIVE_CASELIST_KEY);
    } catch (e) {
      /* ignore */
    }
  }, [activeCaselistId]);

  // One-time check for data left over from before caselists existed, so
  // the "create caselist" screen can offer to import it.
  useEffect(() => {
    if (!user) return;
    get(ref(db, "casesById"))
      .then((snap) => {
        const obj = snap.val();
        setLegacyCount(obj ? Object.keys(obj).length : 0);
      })
      .catch(() => setLegacyCount(0));
  }, [user]);

  // Called if a read for the active caselist suddenly starts failing —
  // almost always because the owner removed this person's membership.
  // Cleans up the stale local index entry (only a user's own userCaselists
  // writes are permitted by the rules) and drops back to the picker.
  function handleLostAccess() {
    if (user && activeCaselistId) {
      dbSet(ref(db, `userCaselists/${user.uid}/${activeCaselistId}`), null).catch(() => {});
    }
    setActiveCaselistId(null);
    showToast("you no longer have access to that caselist");
  }

  // --- Active caselist's metadata (name, join code, owner) ---
  useEffect(() => {
    if (!activeCaselistId) {
      setCaselistMeta(null);
      return;
    }
    const r = ref(db, `caselists/${activeCaselistId}/meta`);
    const unsubscribe = onValue(
      r,
      (snap) => setCaselistMeta(snap.val()),
      () => {
        setCaselistMeta(null);
        handleLostAccess();
      }
    );
    return () => unsubscribe();
  }, [activeCaselistId]);

  // --- Cases for the active caselist ---
  useEffect(() => {
    if (!activeCaselistId) {
      setCases(null);
      return;
    }
    setCases(null);
    const r = ref(db, `caselists/${activeCaselistId}/casesById`);
    const unsubscribe = onValue(
      r,
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
        handleLostAccess();
      }
    );
    return () => unsubscribe();
  }, [activeCaselistId]);

  function casePath(id) {
    return `caselists/${activeCaselistId}/casesById/${id}`;
  }

  // Writes only the one case that changed, to its own Firebase key, so
  // editing case A can never overwrite a concurrent edit to case B.
  function scheduleWrite(caseObj) {
    const id = caseObj.id;
    if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
    pendingWrites.current += 1;
    setSaveStatus("saving");
    writeTimers.current[id] = setTimeout(async () => {
      try {
        await dbSet(ref(db, casePath(id)), JSON.stringify(caseObj));
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
    if (!window.confirm(`delete ${label} for everyone in this caselist? this can't be undone.`)) return;
    if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
    setCases((prev) => prev.filter((c) => c.id !== id));
    dbSet(ref(db, casePath(id)), null).catch((e) => {
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
    if (window.confirm("delete every case and flow in this caselist for everyone? this can't be undone.")) {
      Object.values(writeTimers.current).forEach(clearTimeout);
      writeTimers.current = {};
      setCases([]);
      dbSet(ref(db, `caselists/${activeCaselistId}/casesById`), null).catch((e) => {
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

  if (user === undefined) {
    return <LoadingScreen rootStyle={rootStyle} text="loading…" />;
  }

  if (user === null) {
    return <SignInScreen rootStyle={rootStyle} />;
  }

  if (myCaselists === null) {
    return <LoadingScreen rootStyle={rootStyle} text="loading your caselists…" />;
  }

  if (!activeCaselistId) {
    return (
      <CaselistPicker
        rootStyle={rootStyle}
        user={user}
        myCaselists={myCaselists}
        legacyCount={legacyCount}
        onSelect={(id) => setActiveCaselistId(id)}
        onSignOut={() => signOutOfGoogle()}
      />
    );
  }

  if (cases === null || !caselistMeta) {
    return <LoadingScreen rootStyle={rootStyle} text="loading case list…" />;
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
          <CaselistBar
            meta={caselistMeta}
            user={user}
            onSwitch={() => setShowSwitcher(true)}
            onMembers={() => setShowMembers(true)}
            onSignOut={() => signOutOfGoogle()}
          />
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

      {showSwitcher && (
        <CaselistSwitcherModal
          user={user}
          myCaselists={myCaselists}
          legacyCount={legacyCount}
          activeCaselistId={activeCaselistId}
          onClose={() => setShowSwitcher(false)}
          onSelect={(id) => {
            setActiveCaselistId(id);
            setShowSwitcher(false);
          }}
        />
      )}

      {showMembers && (
        <MembersModal
          caselistId={activeCaselistId}
          meta={caselistMeta}
          user={user}
          onClose={() => setShowMembers(false)}
          onLeft={() => {
            setShowMembers(false);
            setActiveCaselistId(null);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- Auth & caselists ----------------------------- */

function LoadingScreen({ rootStyle, text }) {
  return (
    <div
      className="cp-root"
      style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}
    >
      <StyleBlock />
      <p style={{ color: "var(--cp-muted)", fontFamily: "var(--cp-body)", fontSize: 13 }}>{text}</p>
    </div>
  );
}

// A plain circle-and-letter mark rather than Google's actual four-color
// logomark — avoids reproducing a trademarked asset while still reading
// clearly as "this button is for Google" next to the button's own label.
function GoogleGIcon() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "#4285F4",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--cp-display)",
        flexShrink: 0,
      }}
    >
      G
    </span>
  );
}

function SignInScreen({ rootStyle }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setError("sign-in didn't go through — try again");
      }
    } finally {
      setBusy(false);
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
          maxWidth: 340,
          border: "1px solid var(--cp-border)",
          background: "var(--cp-surface)",
          borderRadius: 10,
          padding: 28,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontFamily: "var(--cp-display)", fontWeight: 700, fontSize: 22, margin: "0 0 8px" }}>
          goosebrief
        </h1>
        <p style={{ color: "var(--cp-muted)", fontSize: 13, margin: "0 0 20px" }}>
          sign in to access your team's caselists
        </p>
        <button
          className="cp-btn"
          onClick={handleSignIn}
          disabled={busy}
          style={{ width: "100%", justifyContent: "center", gap: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
        >
          <GoogleGIcon /> {busy ? "signing in…" : "sign in with Google"}
        </button>
        {error && <p style={{ color: "var(--cp-bad)", fontSize: 11, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

// Shared list-and-forms UI for choosing, creating, or joining a caselist.
// Used both as the full-page picker (before any caselist is active) and
// embedded in a modal (to join/create an additional one while already
// working in a caselist) — the two call sites just wrap it differently.
function CaselistManager({ user, myCaselists, legacyCount, activeCaselistId, onSelect }) {
  const [mode, setMode] = useState("choose"); // choose | create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importAfterCreate, setImportAfterCreate] = useState(true);
  const [result, setResult] = useState(null);

  const ids = Object.keys(myCaselists);

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const res = await createCaselist(user, name);
      if (importAfterCreate && legacyCount > 0) {
        await importLegacyCases(res.caselistId);
      }
      setResult(res);
    } catch (e) {
      setError(e.message || "couldn't create caselist");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError("");
    try {
      const res = await joinCaselist(user, name, code);
      onSelect(res.caselistId);
    } catch (e) {
      setError(e.message || "couldn't join caselist");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    fontSize: 13,
    border: "1px solid var(--cp-border)",
    borderRadius: 6,
    padding: "8px 10px",
    marginTop: 4,
    marginBottom: 12,
  };

  const errorStyle = {
    color: "var(--cp-bad)",
    fontSize: 12,
    background: "rgba(193, 88, 74, 0.12)",
    border: "1px solid var(--cp-bad)",
    borderRadius: 6,
    padding: "8px 10px",
    marginBottom: 10,
  };

  if (result) {
    return (
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--cp-display)", fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>
          {result.name} is ready
        </h1>
        <p style={{ color: "var(--cp-muted)", fontSize: 12, margin: "0 0 16px" }}>
          share this join code with your team — they'll need the caselist name and this code to get in.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: "var(--cp-accent)" }}>
            {result.joinCode}
          </span>
          <button className="cp-btn-icon" onClick={() => navigator.clipboard.writeText(result.joinCode)} title="copy code">
            <Copy size={14} />
          </button>
        </div>
        <button
          className="cp-btn"
          onClick={() => onSelect(result.caselistId)}
          style={{ width: "100%", justifyContent: "center", padding: "9px 0", fontSize: 13, fontWeight: 600 }}
        >
          enter {result.name}
        </button>
      </div>
    );
  }

  return (
    <div>
      {ids.length > 0 && mode === "choose" && (
        <div style={{ marginBottom: 18 }}>
          <Label>your caselists</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {ids.map((id) => (
              <button
                key={id}
                className="cp-btn"
                onClick={() => onSelect(id)}
                style={{
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  fontSize: 13,
                  borderColor: id === activeCaselistId ? "var(--cp-accent)" : "var(--cp-border)",
                }}
              >
                {myCaselists[id].name}
                <span style={{ fontSize: 10, color: "var(--cp-muted)" }}>
                  {id === activeCaselistId ? "current" : myCaselists[id].role}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "choose" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="cp-btn" onClick={() => setMode("create")} style={{ flex: 1, justifyContent: "center", padding: "9px 0", fontSize: 12 }}>
            <Plus size={13} /> create caselist
          </button>
          <button className="cp-btn" onClick={() => setMode("join")} style={{ flex: 1, justifyContent: "center", padding: "9px 0", fontSize: 12 }}>
            join caselist
          </button>
        </div>
      )}

      {mode === "create" && (
        <div>
          <Label>caselist name</Label>
          <input
            className="cp-input"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g. lincoln-debate-2026"
            style={{ ...inputStyle, width: "100%" }}
          />
          {legacyCount > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--cp-muted)", marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={importAfterCreate} onChange={(e) => setImportAfterCreate(e.target.checked)} />
              import {legacyCount} existing case{legacyCount === 1 ? "" : "s"} from before caselists
            </label>
          )}
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="cp-btn-icon"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              style={{ border: "1px solid var(--cp-border)", padding: "8px 10px" }}
            >
              back
            </button>
            <button
              className="cp-btn"
              disabled={busy || !name.trim()}
              onClick={handleCreate}
              style={{ flex: 1, justifyContent: "center", padding: "9px 0", fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "creating…" : "create"}
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div>
          <Label>caselist name</Label>
          <input
            className="cp-input"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="ask whoever created it"
            style={{ ...inputStyle, width: "100%" }}
          />
          <Label>join code</Label>
          <input
            className="cp-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            placeholder="6-character code"
            style={{ ...inputStyle, width: "100%", textTransform: "uppercase", letterSpacing: "0.08em" }}
          />
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="cp-btn-icon"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              style={{ border: "1px solid var(--cp-border)", padding: "8px 10px" }}
            >
              back
            </button>
            <button
              className="cp-btn"
              disabled={busy || !name.trim() || !code.trim()}
              onClick={handleJoin}
              style={{ flex: 1, justifyContent: "center", padding: "9px 0", fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "joining…" : "join"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CaselistPicker({ rootStyle, user, myCaselists, legacyCount, onSelect, onSignOut }) {
  return (
    <div
      className="cp-root"
      style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}
    >
      <StyleBlock />
      <div style={{ width: "100%", maxWidth: 380, border: "1px solid var(--cp-border)", background: "var(--cp-surface)", borderRadius: 10, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.displayName || user.email}
            </div>
          </div>
          <button className="cp-btn-icon" onClick={onSignOut} title="sign out">
            <LogOut size={14} />
          </button>
        </div>
        <CaselistManager user={user} myCaselists={myCaselists} legacyCount={legacyCount} activeCaselistId={null} onSelect={onSelect} />
      </div>
    </div>
  );
}

function CaselistBar({ meta, user, onSwitch, onMembers, onSignOut }) {
  if (!meta) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--cp-muted)" }}>
        caselist: <strong style={{ color: "var(--cp-text)", fontWeight: 600 }}>{meta.name}</strong>
      </span>
      <button
        className="cp-btn-icon"
        onClick={onSwitch}
        title="switch, create, or join a caselist"
        style={{ border: "1px solid var(--cp-border)", padding: "3px 7px", gap: 4, fontSize: 11 }}
      >
        <ChevronsUpDown size={11} /> caselists
      </button>
      <button
        className="cp-btn-icon"
        onClick={onMembers}
        title="members & join code"
        style={{ border: "1px solid var(--cp-border)", padding: "3px 7px", gap: 4, fontSize: 11 }}
      >
        <Users size={11} /> members
      </button>
      <span style={{ flex: 1 }} />
      {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />}
      <button className="cp-btn-icon" onClick={onSignOut} title="sign out" style={{ padding: 4 }}>
        <LogOut size={13} />
      </button>
    </div>
  );
}

function CaselistSwitcherModal({ user, myCaselists, legacyCount, activeCaselistId, onClose, onSelect }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div className="cp-card" onClick={(e) => e.stopPropagation()} style={{ padding: 20, width: "100%", maxWidth: 380, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--cp-display)", fontWeight: 600, fontSize: 15 }}>your caselists</div>
          <button className="cp-btn-icon" onClick={onClose} title="close">
            <X size={14} />
          </button>
        </div>
        <CaselistManager
          user={user}
          myCaselists={myCaselists}
          legacyCount={legacyCount}
          activeCaselistId={activeCaselistId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function MembersModal({ caselistId, meta, user, onClose, onLeft }) {
  const [members, setMembers] = useState(null);
  const [code, setCode] = useState(meta?.joinCode || "");
  const [busy, setBusy] = useState(false);
  const myUid = user.uid;

  useEffect(() => {
    const r = ref(db, `caselists/${caselistId}/members`);
    const unsubscribe = onValue(r, (snap) => setMembers(snap.val() || {}));
    return () => unsubscribe();
  }, [caselistId]);

  useEffect(() => {
    setCode(meta?.joinCode || "");
  }, [meta?.joinCode]);

  const isOwner = meta?.ownerUid === myUid;

  async function handleRegenerate() {
    setBusy(true);
    try {
      const newCode = await regenerateJoinCode(caselistId);
      setCode(newCode);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(memberUid) {
    if (!window.confirm("remove this person's access to the caselist?")) return;
    await removeMember(caselistId, memberUid);
  }

  async function handleLeave() {
    const warning = isOwner
      ? "you're the owner — leaving won't transfer ownership, and no one else will be able to manage members or the join code afterward. leave anyway?"
      : "leave this caselist? you'll need the join code to get back in.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      await leaveCaselist(user, caselistId);
      onLeft();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div className="cp-card" onClick={(e) => e.stopPropagation()} style={{ padding: 20, width: "100%", maxWidth: 400, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ fontFamily: "var(--cp-display)", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{meta?.name}</div>
        <div style={{ fontSize: 11, color: "var(--cp-muted)", marginBottom: 16 }}>
          {members ? Object.keys(members).length : "…"} member{members && Object.keys(members).length === 1 ? "" : "s"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            border: "1px solid var(--cp-border)",
            borderRadius: 8,
            marginBottom: 16,
            background: "var(--cp-surface2)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--cp-muted)", marginBottom: 2 }}>join code</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.1em" }}>{code}</div>
          </div>
          <button className="cp-btn-icon" onClick={() => navigator.clipboard.writeText(code)} title="copy code">
            <Copy size={14} />
          </button>
          {isOwner && (
            <button className="cp-btn-icon" onClick={handleRegenerate} disabled={busy} title="generate a new code">
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {members &&
            Object.entries(members).map(([memberUid, m]) => (
              <div key={memberUid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {m.photoURL ? (
                  <img src={m.photoURL} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--cp-surface2)" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--cp-muted)" }}>
                    {m.role}
                    {memberUid === myUid ? " · you" : ""}
                  </div>
                </div>
                {isOwner && memberUid !== myUid && (
                  <button className="cp-btn-icon" onClick={() => handleRemove(memberUid)} title="remove">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
        </div>

        <button
          onClick={handleLeave}
          disabled={busy}
          style={{
            width: "100%",
            textAlign: "center",
            padding: "8px 0",
            fontSize: 12,
            color: "var(--cp-bad)",
            background: "transparent",
            border: "1px solid var(--cp-border)",
            borderRadius: 6,
            cursor: "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          leave this caselist
        </button>
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
