import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import { Plus, GripVertical } from "lucide-react";
import { uid } from "./utils.js";

/* --------------------------- speech definitions --------------------------- */

export const SPEECH_DEFS = [
  { id: "1ac", label: "1AC", side: "aff", description: "1st Affirmative Constructive" },
  { id: "1nc", label: "1NC", side: "neg", description: "1st Negative Constructive" },
  { id: "2ac", label: "2AC", side: "aff", description: "2nd Affirmative Constructive" },
  { id: "2nc", label: "2NC", side: "neg", description: "2nd Negative Constructive" },
  { id: "1nr", label: "1NR", side: "neg", description: "1st Negative Rebuttal" },
  { id: "1ar", label: "1AR", side: "aff", description: "1st Affirmative Rebuttal" },
  { id: "2nr", label: "2NR", side: "neg", description: "2nd Negative Rebuttal" },
  { id: "2ar", label: "2AR", side: "aff", description: "2nd Affirmative Rebuttal" },
];

export function makeFlowSpeeches() {
  return SPEECH_DEFS.map((def) => ({
    ...def,
    items: [{ id: `${def.id}-${uid()}`, type: "cell", content: "" }],
  }));
}

// Tolerant of missing/partial/legacy data — always returns all 8 speeches
// in order, each with at least one cell.
export function normalizeFlowSpeeches(rawSpeeches) {
  const list = Array.isArray(rawSpeeches) ? rawSpeeches : [];
  return SPEECH_DEFS.map((def) => {
    const found = list.find((s) => s?.id === def.id);
    const items =
      Array.isArray(found?.items) && found.items.length
        ? found.items.map((it) =>
            it?.type === "space"
              ? { id: it.id || uid(), type: "space" }
              : { id: it.id || uid(), type: "cell", content: it?.content || "" }
          )
        : [{ id: `${def.id}-${uid()}`, type: "cell", content: "" }];
    return { ...def, items };
  });
}

export function normalizeFlowConnections(rawConnections) {
  return Array.isArray(rawConnections)
    ? rawConnections
        .filter((c) => c?.fromCellId && c?.toCellId)
        .map((c) => ({ id: c.id || uid(), fromCellId: c.fromCellId, toCellId: c.toCellId }))
    : [];
}

/* -------------------------------- tag detection -------------------------------- */

const TAG_COLORS = [
  "#ffd166", "#00e5a0", "#4d9fff", "#b580ff", "#ff9f5a", "#ff6b9d",
  "#00d4ff", "#ff4d4d", "#a8ff78", "#ffb347", "#c084fc", "#34d399",
  "#f472b6", "#60a5fa", "#fb923c", "#a3e635",
];

function detectTag(content) {
  if (!content) return null;
  const firstWord = content.trimStart().split(/\s/)[0];
  const match = firstWord.match(/^(.+)[:–-]$/);
  if (!match) return null;
  const label = match[1];
  const baseLabel = label.replace(/\d+$/, "");
  let hash = 5381;
  for (let i = 0; i < baseLabel.length; i++) hash = (hash * 33) ^ baseLabel.charCodeAt(i);
  return { label, firstWord, color: TAG_COLORS[Math.abs(hash) % TAG_COLORS.length] };
}

/* ---------------------------------- arg cell ---------------------------------- */

const FlowArgCell = forwardRef(function FlowArgCell(
  { cell, speechId, side, onUpdate, onDelete, onAddBelow, isSelected, shouldFocus, onFocusHandled, onCellHover },
  ref
) {
  const textareaRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const tag = detectTag(cell.content);

  useEffect(() => {
    if (!shouldFocus) return;
    textareaRef.current?.focus();
    onFocusHandled && onFocusHandled();
  }, [shouldFocus, onFocusHandled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [cell.content]);

  const handleChange = useCallback(
    (e) => {
      onUpdate({ content: e.target.value });
      const el = e.target;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    },
    [onUpdate]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onAddBelow();
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && cell.content === "") {
        e.preventDefault();
        onDelete();
      }
    },
    [onAddBelow, onDelete, cell.content]
  );

  const renderOverlay = () => {
    if (!tag) return null;
    const { firstWord } = tag;
    const idx = cell.content.indexOf(firstWord);
    const rest = cell.content.slice(idx + firstWord.length);
    return (
      <div className="cp-flow-tag-overlay" aria-hidden="true">
        <span style={{ color: tag.color, fontWeight: 600 }}>{firstWord}</span>
        <span style={{ color: "var(--cp-text)" }}>{rest}</span>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className={`cp-flow-cell ${side} ${isSelected ? "selected" : ""}`}
      data-flowcell
      data-type="cell"
      data-speech-id={speechId}
      data-cell-id={cell.id}
      onMouseEnter={() => { setHovered(true); onCellHover && onCellHover(true); }}
      onMouseLeave={() => { setHovered(false); onCellHover && onCellHover(false); }}
    >
      <div className="cp-flow-grip" data-grip title="Drag to reorder">
        <GripVertical size={12} />
      </div>
      <div className="cp-flow-textarea-wrap">
        {renderOverlay()}
        <textarea
          ref={textareaRef}
          value={cell.content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={hovered ? "type '[tag]:' to label" : "flow…"}
          rows={1}
          className={`cp-flow-textarea ${tag ? "tagged" : ""}`}
        />
      </div>
    </div>
  );
});

/* ------------------------------- speech column ------------------------------- */

function FlowSpeechColumn({
  speech, onUpdateCellContent, onAddCell, onAddCellAfter, onDeleteCell,
  onReorderItems, pendingCellIds, focusCellId, onFocusHandled, cellRefsMap,
  onHover, onCellHover, isHovered, onDragMove,
}) {
  const items = speech.items || [];
  const [drag, setDrag] = useState(null);
  const itemRefs = useRef({});
  const dragRef = useRef(null);

  const startDrag = useCallback(
    (e, itemId) => {
      if (e.button !== 0) return;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
      e.preventDefault();

      const el = itemRefs.current[itemId];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const item = items.find((it) => it.id === itemId);
      const offsetY = e.clientY - rect.top;

      const cachedRects = {};
      for (const it of items) {
        const itEl = itemRefs.current[it.id];
        if (itEl) cachedRects[it.id] = itEl.getBoundingClientRect();
      }

      let currentY = e.clientY - offsetY;
      const fakeEl = {
        getBoundingClientRect: () => ({
          left: rect.left, right: rect.right,
          top: currentY, bottom: currentY + rect.height,
          height: rect.height, width: rect.width,
        }),
      };
      cellRefsMap.current.set(itemId, fakeEl);

      const calcPlaceholder = (clientY) => {
        const others = items.filter((it) => it.id !== itemId);
        for (let i = 0; i < others.length; i++) {
          const r = cachedRects[others[i].id];
          if (!r) continue;
          if (clientY - offsetY + rect.height / 2 < r.top + r.height / 2) return i;
        }
        return others.length;
      };

      const initialPlaceholder = calcPlaceholder(e.clientY);
      dragRef.current = { itemId, offsetY, placeholderIndex: initialPlaceholder };

      setDrag({
        itemId, x: rect.left, y: currentY, width: rect.width,
        placeholderIndex: initialPlaceholder,
        content: item?.content ?? null,
        isSpace: item?.type === "space",
        side: speech.side,
      });

      const onMove = (e) => {
        if (!dragRef.current) return;
        currentY = e.clientY - dragRef.current.offsetY;
        const newPlaceholder = calcPlaceholder(e.clientY);
        dragRef.current.placeholderIndex = newPlaceholder;

        const floatingEl = document.getElementById(`gb-flow-drag-ghost-${itemId}`);
        if (floatingEl) floatingEl.style.top = currentY + "px";

        setDrag((prev) => (prev ? { ...prev, y: currentY, placeholderIndex: newPlaceholder } : null));
        if (onDragMove) onDragMove();
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (!dragRef.current) return;
        const { itemId, placeholderIndex } = dragRef.current;
        dragRef.current = null;
        setDrag(null);

        const dragged = items.find((it) => it.id === itemId);
        if (dragged) {
          const without = items.filter((it) => it.id !== itemId);
          without.splice(Math.min(placeholderIndex, without.length), 0, dragged);
          onReorderItems(speech.id, without);
        }
        if (onDragMove) {
          requestAnimationFrame(() => {
            onDragMove();
            requestAnimationFrame(() => onDragMove());
          });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [items, speech.id, speech.side, cellRefsMap, onReorderItems, onDragMove]
  );

  let displayItems = items;
  if (drag) {
    const without = items.filter((it) => it.id !== drag.itemId);
    without.splice(Math.min(drag.placeholderIndex, without.length), 0, { id: "__placeholder__", type: "placeholder" });
    displayItems = without;
  }

  return (
    <div
      className={`cp-flow-col ${isHovered ? "hovered" : ""}`}
      onMouseEnter={() => onHover && onHover(speech.id)}
      onMouseLeave={() => onHover && onHover(null)}
    >
      <div className={`cp-flow-col-header ${speech.side}`}>{speech.label}</div>

      <div className="cp-flow-cells">
        {displayItems.map((item) => {
          if (item.type === "placeholder") {
            return (
              <div key="__placeholder__" className={`cp-flow-placeholder ${drag?.isSpace ? "space" : ""}`}>
                {!drag?.isSpace && <span className="cp-flow-placeholder-text">{drag?.content || ""}</span>}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              ref={(el) => { if (el) itemRefs.current[item.id] = el; else delete itemRefs.current[item.id]; }}
              className="cp-flow-item-wrap"
              onPointerDown={(e) => startDrag(e, item.id)}
            >
              {item.type === "space" ? (
                <div
                  className="cp-flow-space"
                  data-flowcell
                  data-speech-id={speech.id}
                  data-cell-id={item.id}
                  data-type="space"
                  onMouseEnter={() => onCellHover && onCellHover(speech.id, item.id, "space")}
                  onMouseLeave={() => onCellHover && onCellHover(null, null, null)}
                />
              ) : (
                <FlowArgCell
                  cell={item}
                  speechId={speech.id}
                  side={speech.side}
                  onUpdate={(updates) => onUpdateCellContent(speech.id, item.id, updates.content)}
                  onDelete={() => {
                    const idx = items.findIndex((it) => it.id === item.id);
                    onDeleteCell(speech.id, item.id);
                    const prevCell = [...items.slice(0, idx)].reverse().find((it) => it.type === "cell");
                    if (prevCell) {
                      requestAnimationFrame(() => {
                        const el = cellRefsMap.current.get(prevCell.id);
                        const textarea = el && el.querySelector ? el.querySelector("textarea") : null;
                        if (textarea) {
                          textarea.focus();
                          const len = textarea.value.length;
                          textarea.setSelectionRange(len, len);
                        }
                      });
                    }
                  }}
                  onAddBelow={() => onAddCellAfter(speech.id, item.id)}
                  isSelected={pendingCellIds ? pendingCellIds.has(item.id) : false}
                  shouldFocus={item.id === focusCellId}
                  onFocusHandled={onFocusHandled}
                  onCellHover={onCellHover ? (entering) => onCellHover(entering ? speech.id : null, entering ? item.id : null, entering ? "cell" : null) : null}
                  ref={(el) => {
                    if (el) {
                      cellRefsMap.current.set(item.id, el);
                    } else if (!dragRef.current || dragRef.current.itemId !== item.id) {
                      cellRefsMap.current.delete(item.id);
                    }
                  }}
                />
              )}
            </div>
          );
        })}
        <button className="cp-flow-addcell" onClick={() => onAddCell(speech.id)}>
          <Plus size={11} style={{ verticalAlign: -1 }} /> add
        </button>
      </div>

      {drag && createPortal(
        <div
          id={`gb-flow-drag-ghost-${drag.itemId}`}
          className={`cp-flow-floating ${drag.isSpace ? "space" : ""}`}
          style={{ top: drag.y, left: drag.x, width: drag.width }}
        >
          {!drag.isSpace && (drag.content || <em style={{ fontStyle: "normal", color: "var(--cp-muted)" }}>flow…</em>)}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------------------------------- board ---------------------------------- */

export function FlowBoard({
  flow,
  onAddCell, onAddCellAfter, onDeleteCell,
  onAddEmptySpace, onDeleteEmptySpace,
  onReorderItems, onUpdateCellContent,
  onAddConnection, onRemoveConnection,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [focusCellId, setFocusCellId] = useState(null);
  const [pendingFrom, setPendingFrom] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hoveredSpeechId, setHoveredSpeechId] = useState(null);
  const [highlightConnId, setHighlightConnId] = useState(null);
  const [hoveredCellType, setHoveredCellType] = useState(null);
  const [, forceUpdate] = useState(0);

  const hoveredConnRef = useRef(null);
  const hoveredCellRef = useRef(null);
  const cellRefsMap = useRef(new Map());
  const mousePosRef = useRef(null);
  const boardOuterRef = useRef(null);
  const boardScrollRef = useRef(null);
  const svgRef = useRef(null);
  const connPathsRef = useRef(new Map());
  const flowRef = useRef(flow);
  useEffect(() => { flowRef.current = flow; }, [flow]);

  const handleAddCellAfter = useCallback(
    (speechId, cellId) => {
      const newId = onAddCellAfter(speechId, cellId);
      setFocusCellId(newId);
    },
    [onAddCellAfter]
  );

  const deleteCellAndRedraw = useCallback(
    (speechId, cellId) => {
      onDeleteCell(speechId, cellId);
      requestAnimationFrame(() => {
        forceUpdate((n) => n + 1);
        requestAnimationFrame(() => forceUpdate((n) => n + 1));
      });
    },
    [onDeleteCell]
  );

  // Redraw lines on scroll/resize
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const update = () => forceUpdate((n) => n + 1);
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  // Blur active textarea when clicking outside a cell within THIS board
  useEffect(() => {
    const onMouseDown = (e) => {
      const active = document.activeElement;
      if (active?.tagName !== "TEXTAREA") return;
      if (!boardOuterRef.current?.contains(active)) return;
      const withinACell = e.target.closest && e.target.closest("[data-flowcell]");
      const withinThisBoard = boardOuterRef.current?.contains(e.target);
      if (!withinACell || !withinThisBoard) active.blur();
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (pendingFrom.length > 0) {
        const svgEl = svgRef.current;
        if (svgEl) {
          const rect = svgEl.getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }
      const svgEl = svgRef.current;
      if (!svgEl || connPathsRef.current.size === 0) {
        hoveredConnRef.current = null;
        setHighlightConnId(null);
        return;
      }
      const rect = svgEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let bestId = null;
      let bestDist = 12;
      const connIds = (flowRef.current?.connections || []).map((c) => c.id);
      for (const connId of connIds) {
        const pathEl = connPathsRef.current.get(connId);
        if (!pathEl) continue;
        const len = pathEl.getTotalLength();
        const steps = Math.max(20, Math.floor(len / 8));
        for (let i = 0; i <= steps; i++) {
          const pt = pathEl.getPointAtLength((i / steps) * len);
          const dist = Math.hypot(pt.x - mx, pt.y - my);
          if (dist < bestDist) { bestDist = dist; bestId = connId; }
        }
      }
      hoveredConnRef.current = bestId;
      setHighlightConnId((prev) => (prev === bestId ? prev : bestId));
    };

    const rehoverAtMouse = () => {
      const pos = mousePosRef.current;
      if (!pos) return;
      const el = document.elementFromPoint(pos.x, pos.y);
      const target = el && el.closest ? el.closest("[data-flowcell]") : null;
      if (target && boardOuterRef.current?.contains(target)) {
        const speechId = target.dataset.speechId;
        const cellId = target.dataset.cellId;
        const type = target.dataset.type || "cell";
        hoveredCellRef.current = { speechId, cellId, type };
        setHoveredCellType(type);
        setHoveredSpeechId(speechId);
      } else {
        hoveredCellRef.current = null;
        setHoveredCellType(null);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") { setPendingFrom([]); setCursor(null); }
      if (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT") return;
      if (e.key === "a" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (hoveredSpeechId) onAddCell(hoveredSpeechId);
      }
      if (e.key === "b" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (hoveredSpeechId) onAddEmptySpace(hoveredSpeechId);
      }
      if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const hovered = hoveredCellRef.current;
        if (hovered) handleConnectAction(hovered.speechId, hovered.cellId);
      }
      if ((e.key === "x" || e.key === "Delete") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const connId = hoveredConnRef.current;
        if (connId) {
          onRemoveConnection(connId);
        } else {
          const hovered = hoveredCellRef.current;
          if (hovered) {
            if (hovered.type === "space") onDeleteEmptySpace(hovered.speechId, hovered.cellId);
            else deleteCellAndRedraw(hovered.speechId, hovered.cellId);
            requestAnimationFrame(rehoverAtMouse);
          }
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFrom.length, hoveredSpeechId, onAddCell, onAddEmptySpace, onDeleteEmptySpace, onRemoveConnection, deleteCellAndRedraw]);

  const handleConnectAction = useCallback(
    (speechId, cellId) => {
      if (pendingFrom.length === 0) {
        setPendingFrom([{ speechId, cellId }]);
        return;
      }
      const fromSpeechId = pendingFrom[0].speechId;
      if (speechId === fromSpeechId) {
        const already = pendingFrom.some((p) => p.cellId === cellId);
        if (already) {
          const next = pendingFrom.filter((p) => p.cellId !== cellId);
          setPendingFrom(next);
          if (next.length === 0) setCursor(null);
        } else {
          setPendingFrom((prev) => [...prev, { speechId, cellId }]);
        }
        return;
      }
      pendingFrom.forEach((src) => onAddConnection(src.cellId, cellId));
      setPendingFrom([]);
      setCursor(null);
    },
    [pendingFrom, onAddConnection]
  );

  const getLineCoords = useCallback((fromCellId, toCellId) => {
    const fromEl = cellRefsMap.current.get(fromCellId);
    const toEl = cellRefsMap.current.get(toCellId);
    const svgEl = svgRef.current;
    if (!fromEl || !toEl || !svgEl) return null;
    const svgRect = svgEl.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const goingRight = fromRect.left < toRect.left;
    return {
      x1: (goingRight ? fromRect.right : fromRect.left) - svgRect.left,
      y1: fromRect.top + fromRect.height / 2 - svgRect.top,
      x2: (goingRight ? toRect.left : toRect.right) - svgRect.left,
      y2: toRect.top + toRect.height / 2 - svgRect.top,
    };
  }, []);

  const getCellEdgeCoords = useCallback((cellId) => {
    const el = cellRefsMap.current.get(cellId);
    const svgEl = svgRef.current;
    if (!el || !svgEl) return null;
    const svgRect = svgEl.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { left: rect.left - svgRect.left, right: rect.right - svgRect.left, y: rect.top + rect.height / 2 - svgRect.top };
  }, []);

  const pendingCellIds = new Set(pendingFrom.map((p) => p.cellId));
  const isPending = pendingFrom.length > 0;
  const connMarkerId = `gb-arrow-${flow.id}`;
  const draftMarkerId = `gb-arrow-draft-${flow.id}`;

  return (
    <div ref={boardOuterRef} style={{ position: "relative" }}>
      <button
        className="cp-flow-help-btn"
        style={{ position: "absolute", top: 6, right: 6, zIndex: 30 }}
        onClick={() => setShowHelp((v) => !v)}
        title="Shortcuts"
      >
        ?
      </button>

      <div
        ref={boardScrollRef}
        className="cp-scroll"
        style={{ overflow: "auto", maxHeight: 560, minHeight: 320, border: "1px solid var(--cp-border)", borderRadius: 8, background: "var(--cp-bg)" }}
        onClick={(e) => {
          if (e.target === boardScrollRef.current || e.target === e.currentTarget.firstChild) {
            setPendingFrom([]); setCursor(null);
          }
        }}
      >
        <div style={{ display: "flex", gap: 20, padding: "28px 30px 140px", alignItems: "stretch", minHeight: "calc(100% + 160px)", width: "max-content", minWidth: "100%", position: "relative" }}>
          <svg ref={svgRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
            <defs>
              <marker id={connMarkerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7" fill="none" stroke="var(--cp-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker id={draftMarkerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7" fill="none" stroke="var(--cp-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {flow.connections.map((conn) => {
              const coords = getLineCoords(conn.fromCellId, conn.toCellId);
              if (!coords) return null;
              const { x1, y1, x2, y2 } = coords;
              const cx = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
              const isHovered = conn.id === highlightConnId;
              return (
                <path
                  key={conn.id}
                  ref={(el) => { if (el) connPathsRef.current.set(conn.id, el); else connPathsRef.current.delete(conn.id); }}
                  d={d} fill="none" stroke="var(--cp-accent)" strokeWidth="1.5" strokeDasharray="5 4"
                  opacity={isHovered ? 0.75 : 0.4} markerEnd={`url(#${connMarkerId})`}
                />
              );
            })}
            {isPending && cursor && pendingFrom.map((src) => {
              const from = getCellEdgeCoords(src.cellId);
              if (!from) return null;
              const goingRight = cursor.x > from.right;
              const fromX = goingRight ? from.right : from.left;
              const cx = (fromX + cursor.x) / 2;
              const d = `M ${fromX} ${from.y} C ${cx} ${from.y}, ${cx} ${cursor.y}, ${cursor.x} ${cursor.y}`;
              return <path key={`draft-${src.cellId}`} d={d} fill="none" stroke="var(--cp-accent)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.35" markerEnd={`url(#${draftMarkerId})`} style={{ pointerEvents: "none" }} />;
            })}
          </svg>

          {flow.speeches.map((speech) => (
            <FlowSpeechColumn
              key={speech.id}
              speech={speech}
              onUpdateCellContent={onUpdateCellContent}
              onAddCell={onAddCell}
              onAddCellAfter={handleAddCellAfter}
              onDeleteCell={deleteCellAndRedraw}
              onReorderItems={onReorderItems}
              pendingCellIds={pendingCellIds}
              focusCellId={focusCellId}
              onFocusHandled={() => setFocusCellId(null)}
              cellRefsMap={cellRefsMap}
              onHover={setHoveredSpeechId}
              onCellHover={(speechId, cellId, type) => { hoveredCellRef.current = speechId && cellId ? { speechId, cellId, type } : null; setHoveredCellType(speechId ? type : null); }}
              isHovered={hoveredSpeechId === speech.id}
              onDragMove={() => forceUpdate((n) => n + 1)}
            />
          ))}
        </div>
      </div>

      {isPending && (
        <div className="cp-flow-hint active">
          {pendingFrom.length === 1
            ? "press c on another cell to connect · x/Delete to delete hovered · Esc to cancel"
            : `${pendingFrom.length} selected · press c in another speech · Esc to cancel`}
        </div>
      )}
      {!isPending && hoveredCellType === "cell" && (
        <div className="cp-flow-hint">c · connect &nbsp;·&nbsp; x/Delete · delete &nbsp;·&nbsp; a · add below &nbsp;·&nbsp; b · blank space</div>
      )}
      {!isPending && hoveredCellType === "space" && (
        <div className="cp-flow-hint">x · delete spacer</div>
      )}

      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div className="cp-card" onClick={(e) => e.stopPropagation()} style={{ padding: 20, maxWidth: 380 }}>
            <div style={{ fontFamily: "var(--cp-display)", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>flow shortcuts</div>
            {[
              ["a", "add argument to hovered column"],
              ["b", "add spacer to hovered column"],
              ["c", "connect hovered cell (press again on target cell)"],
              ["x / Delete", "delete hovered cell or connection"],
              ["Enter", "new argument below current cell"],
              ["Shift+Enter", "new line within cell"],
              ["Backspace / Delete", "delete an empty cell"],
              ["Drag", "reorder items within column"],
              ["Esc", "cancel connection"],
            ].map(([k, d]) => (
              <div key={k} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6, fontSize: 12, color: "var(--cp-text)" }}>
                <span style={{ minWidth: 100, fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-accent)" }}>{k}</span>
                <span style={{ color: "var(--cp-muted)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
