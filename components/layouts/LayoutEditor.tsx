"use client";

import {
  DoorOpen,
  Download,
  Eraser,
  FileDown,
  Grid3X3,
  Hand,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Square,
  Rows3,
  TextCursorInput,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LayoutDocument,
  LayoutObject,
  LayoutPage,
  LayoutPoint,
  LayoutTool,
} from "@/components/layouts/types";
import { canvasToBlob, drawObject, renderLayoutPage, renderPageToCanvas } from "@/components/layouts/layout-renderer";
import { layoutDocumentToPdf } from "@/components/layouts/pdf-export";

type Props = {
  jobId: string;
  name: string;
  document: LayoutDocument;
  canManage: boolean;
  saveState: "saved" | "saving" | "offline" | "error" | "conflict";
  onDocumentChange: (document: LayoutDocument) => void;
  onPreview: (blob: Blob) => Promise<void | string>;
};

const colors = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

export default function LayoutEditor({
  jobId,
  name,
  document,
  canManage,
  saveState,
  onDocumentChange,
  onPreview,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const interaction = useRef<{
    pointerId: number;
    start: LayoutPoint;
    last: LayoutPoint;
    draft: LayoutObject | null;
    panStart?: { x: number; y: number; offsetX: number; offsetY: number };
  } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; center: { x: number; y: number } } | null>(null);
  const undoStack = useRef<LayoutDocument[]>([]);
  const redoStack = useRef<LayoutDocument[]>([]);
  const [tool, setTool] = useState<LayoutTool>("pen");
  const [color, setColor] = useState(colors[0]);
  const [thickness, setThickness] = useState(4);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(0.75);
  const [offset, setOffset] = useState({ x: 28, y: 28 });
  const [viewport, setViewport] = useState({ width: 900, height: 620 });
  const [draft, setDraft] = useState<LayoutObject | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [online, setOnline] = useState(true);
  const page = useMemo(
    () => document.pages.find((item) => item.id === document.activePageId) ?? document.pages[0],
    [document],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.width * ratio);
    canvas.height = Math.round(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#d1d5db";
    context.fillRect(0, 0, viewport.width, viewport.height);
    context.save();
    context.translate(offset.x, offset.y);
    context.scale(zoom, zoom);
    context.shadowColor = "rgba(0,0,0,.18)";
    context.shadowBlur = 12 / zoom;
    context.shadowOffsetY = 3 / zoom;
    renderLayoutPage(context, page);
    context.shadowColor = "transparent";
    if (draft) drawObject(context, draft);
    context.restore();
  }, [draft, offset, page, viewport, zoom]);

  useEffect(() => redraw(), [redraw]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(460, Math.min(720, window.innerHeight - 260)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const previewCanvas = renderPageToCanvas(page, 900);
        await onPreview(await canvasToBlob(previewCanvas));
      } catch {
        // Preview generation is best-effort; editable autosave remains authoritative.
      }
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [document, onPreview, page]);

  function commit(next: LayoutDocument, trackHistory = true) {
    if (!canManage) return;
    if (trackHistory) {
      undoStack.current.push(structuredClone(document));
      if (undoStack.current.length > 75) undoStack.current.shift();
      redoStack.current = [];
    }
    onDocumentChange(next);
  }

  function updatePage(nextPage: LayoutPage, trackHistory = true) {
    commit({
      ...document,
      pages: document.pages.map((item) => item.id === nextPage.id ? nextPage : item),
    }, trackHistory);
  }

  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(structuredClone(document));
    onDocumentChange(previous);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(structuredClone(document));
    onDocumentChange(next);
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const raw = {
      x: (event.clientX - bounds.left - offset.x) / zoom,
      y: (event.clientY - bounds.top - offset.y) / zoom,
      pressure: event.pressure || undefined,
    };
    return snap && tool !== "pen" && tool !== "eraser"
      ? { ...raw, x: Math.round(raw.x / page.gridSize) * page.gridSize, y: Math.round(raw.y / page.gridSize) * page.gridSize }
      : raw;
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canManage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      interaction.current = null;
      setDraft(null);
      const values = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y),
        zoom,
        center: { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 },
      };
      return;
    }
    const point = canvasPoint(event);
    if (tool === "pan") {
      interaction.current = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        draft: null,
        panStart: { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y },
      };
      return;
    }
    if (tool === "eraser") {
      eraseAt(point);
      interaction.current = { pointerId: event.pointerId, start: point, last: point, draft: null };
      return;
    }
    if (tool === "text" || tool === "room") {
      const value = window.prompt(tool === "room" ? "Room label" : "Text label");
      if (value?.trim()) {
        updatePage({
          ...page,
          objects: [...page.objects, {
            id: crypto.randomUUID(),
            type: tool,
            point,
            text: value.trim(),
            fontSize: tool === "room" ? 30 : 22,
            color,
            thickness,
          }],
        });
      }
      return;
    }
    if (tool === "door" || tool === "stairs" || tool === "transition") {
      updatePage({
        ...page,
        objects: [...page.objects, {
          id: crypto.randomUUID(),
          type: "symbol",
          symbol: tool,
          point,
          size: tool === "transition" ? 100 : 70,
          color,
          thickness,
        }],
      });
      return;
    }
    const object = makeDraft(tool, point, color, thickness);
    interaction.current = { pointerId: event.pointerId, start: point, last: point, draft: object };
    setDraft(object);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const values = [...pointers.current.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      setZoom(clamp(pinch.current.zoom * (distance / Math.max(1, pinch.current.distance)), 0.2, 3));
      return;
    }
    const current = interaction.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.panStart) {
      setOffset({
        x: current.panStart.offsetX + event.clientX - current.panStart.x,
        y: current.panStart.offsetY + event.clientY - current.panStart.y,
      });
      return;
    }
    const point = canvasPoint(event);
    current.last = point;
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    if (!current.draft) return;
    if (current.draft.type === "stroke") current.draft = { ...current.draft, points: [...current.draft.points, point] };
    else if ("end" in current.draft) current.draft = { ...current.draft, end: point };
    setDraft(current.draft);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const current = interaction.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.draft) {
      let object = current.draft;
      if (object.type === "dimension") {
        const label = window.prompt("Dimension (feet/inches)", "0' 0\"")?.trim();
        if (!label) {
          setDraft(null);
          interaction.current = null;
          return;
        }
        object = { ...object, label };
      }
      updatePage({ ...page, objects: [...page.objects, object] });
    }
    setDraft(null);
    interaction.current = null;
  }

  function eraseAt(point: LayoutPoint) {
    const index = [...page.objects].reverse().findIndex((object) => hitObject(object, point, 18 / zoom));
    if (index < 0) return;
    const actualIndex = page.objects.length - 1 - index;
    updatePage({ ...page, objects: page.objects.filter((_, itemIndex) => itemIndex !== actualIndex) });
  }

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const cursor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const nextZoom = clamp(zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.2, 3);
    const world = { x: (cursor.x - offset.x) / zoom, y: (cursor.y - offset.y) / zoom };
    setZoom(nextZoom);
    setOffset({ x: cursor.x - world.x * nextZoom, y: cursor.y - world.y * nextZoom });
  }

  function addPage() {
    const id = crypto.randomUUID();
    const nextPage: LayoutPage = {
      id,
      name: `Page ${document.pages.length + 1}`,
      width: page.width,
      height: page.height,
      gridSize: page.gridSize,
      showGrid: page.showGrid,
      objects: [],
    };
    commit({ ...document, activePageId: id, pages: [...document.pages, nextPage] });
  }

  function deletePage() {
    if (document.pages.length === 1 || !window.confirm(`Delete ${page.name}?`)) return;
    const pages = document.pages.filter((item) => item.id !== page.id);
    commit({ ...document, activePageId: pages[0].id, pages });
  }

  async function exportFile(kind: "png" | "pdf", saveToFiles: boolean) {
    setExporting(true);
    setExportMessage("");
    try {
      const blob = kind === "png"
        ? await canvasToBlob(renderPageToCanvas(page))
        : await layoutDocumentToPdf(document);
      const fileName = `${safeName(name)}${kind === "png" ? `-${safeName(page.name)}.png` : ".pdf"}`;
      if (saveToFiles) {
        const formData = new FormData();
        formData.set("file", new File([blob], fileName, { type: blob.type }));
        formData.set("kind", "file");
        formData.set("category", "Diagram");
        formData.set("description", `Exported from editable layout: ${name}`);
        const response = await fetch(`/api/jobs/${jobId}/attachments`, { method: "POST", body: formData });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to save the export to Job Files.");
        setExportMessage(`${kind.toUpperCase()} saved to Job Files.`);
      } else {
        download(blob, fileName);
        setExportMessage(`${kind.toUpperCase()} downloaded.`);
      }
      if (kind === "png") await onPreview(blob);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-white p-2">
        <ToolButton active={tool === "pen"} label="Pen" onClick={() => setTool("pen")}><MousePointer2 /></ToolButton>
        <ToolButton active={tool === "eraser"} label="Eraser" onClick={() => setTool("eraser")}><Eraser /></ToolButton>
        <ToolButton active={tool === "line"} label="Line" onClick={() => setTool("line")}><Minus /></ToolButton>
        <ToolButton active={tool === "rectangle"} label="Rectangle" onClick={() => setTool("rectangle")}><Square /></ToolButton>
        <ToolButton active={tool === "text"} label="Text" onClick={() => setTool("text")}><TextCursorInput /></ToolButton>
        <ToolButton active={tool === "dimension"} label="Dimension" onClick={() => setTool("dimension")}>↔</ToolButton>
        <ToolButton active={tool === "room"} label="Room label" onClick={() => setTool("room")}>Room</ToolButton>
        <ToolButton active={tool === "door"} label="Door" onClick={() => setTool("door")}><DoorOpen /></ToolButton>
        <ToolButton active={tool === "stairs"} label="Stairs" onClick={() => setTool("stairs")}><Rows3 /></ToolButton>
        <ToolButton active={tool === "transition"} label="Transition" onClick={() => setTool("transition")}>T</ToolButton>
        <ToolButton active={tool === "pan"} label="Pan" onClick={() => setTool("pan")}><Hand /></ToolButton>
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <button type="button" onClick={undo} className="tool-button" title="Undo"><Undo2 /></button>
        <button type="button" onClick={redo} className="tool-button" title="Redo"><Redo2 /></button>
        <label className="ml-1 flex items-center gap-1 text-[11px] font-medium text-gray-600">
          Color
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-9 rounded border border-gray-300 bg-white p-0.5" />
        </label>
        <div className="flex gap-1">
          {colors.map((value) => <button key={value} type="button" onClick={() => setColor(value)} className={`h-6 w-6 rounded-full border-2 ${color === value ? "border-black" : "border-white ring-1 ring-gray-300"}`} style={{ backgroundColor: value }} aria-label={`Use ${value}`} />)}
        </div>
        <label className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
          Width
          <input type="range" min="1" max="18" value={thickness} onChange={(event) => setThickness(Number(event.target.value))} className="w-20" />
        </label>
        <button type="button" onClick={() => setSnap((value) => !value)} className={`tool-button ${snap ? "bg-gray-900 text-white" : ""}`} title="Grid snapping"><Grid3X3 /></button>
      </div>

      <div ref={viewportRef} className="relative w-full overflow-hidden bg-gray-300" style={{ height: viewport.height }}>
        <canvas
          ref={canvasRef}
          className="block touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 text-[10px] font-medium text-white">
          {Math.round(zoom * 100)}% · {saveStateLabel(saveState)}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {document.pages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onDocumentChange({ ...document, activePageId: item.id })}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${item.id === page.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {item.name}
            </button>
          ))}
          {canManage ? <button type="button" onClick={addPage} className="tool-button" title="Add page"><Plus /></button> : null}
          {canManage && document.pages.length > 1 ? <button type="button" onClick={deletePage} className="tool-button text-red-600" title="Delete current page">×</button> : null}
          <label className="ml-2 flex items-center gap-1 text-[11px] text-gray-600">
            <input type="checkbox" checked={page.showGrid} onChange={(event) => updatePage({ ...page, showGrid: event.target.checked })} />
            Grid
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={exporting} onClick={() => void exportFile("png", false)} className="export-button"><Download /> PNG</button>
          <button type="button" disabled={exporting} onClick={() => void exportFile("pdf", false)} className="export-button"><FileDown /> PDF</button>
          <button type="button" disabled={exporting || !online} onClick={() => void exportFile("png", true)} className="export-button"><Save /> Save PNG</button>
          <button type="button" disabled={exporting || !online} onClick={() => void exportFile("pdf", true)} className="export-button"><Save /> Save PDF</button>
        </div>
      </div>
      {exportMessage ? <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600">{exportMessage}</p> : null}
      <style jsx>{`
        :global(.tool-button) { display:inline-flex; min-height:2rem; min-width:2rem; align-items:center; justify-content:center; gap:.25rem; border-radius:.375rem; padding:.35rem .5rem; font-size:.7rem; font-weight:600; color:#4b5563; }
        :global(.tool-button:hover) { background:#f3f4f6; color:#111827; }
        :global(.tool-button svg), :global(.export-button svg) { width:.875rem; height:.875rem; }
        :global(.export-button) { display:inline-flex; min-height:2rem; align-items:center; gap:.3rem; border:1px solid #d1d5db; border-radius:.375rem; padding:.35rem .55rem; font-size:.7rem; font-weight:600; color:#374151; }
        :global(.export-button:disabled) { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
}

function ToolButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`tool-button ${active ? "!bg-black !text-white" : ""}`} title={label}>{children}<span className="hidden 2xl:inline">{label}</span></button>;
}

function makeDraft(tool: LayoutTool, point: LayoutPoint, color: string, thickness: number): LayoutObject | null {
  const base = { id: crypto.randomUUID(), color, thickness };
  if (tool === "pen") return { ...base, type: "stroke", points: [point] };
  if (tool === "line") return { ...base, type: "line", start: point, end: point };
  if (tool === "rectangle") return { ...base, type: "rectangle", start: point, end: point };
  if (tool === "dimension") return { ...base, type: "dimension", start: point, end: point, label: "" };
  return null;
}

function hitObject(object: LayoutObject, point: LayoutPoint, tolerance: number) {
  if (object.type === "stroke") return object.points.some((value) => distance(value, point) <= tolerance);
  if (object.type === "line" || object.type === "dimension") return distanceToSegment(point, object.start, object.end) <= tolerance;
  if (object.type === "rectangle") {
    const minX = Math.min(object.start.x, object.end.x) - tolerance;
    const maxX = Math.max(object.start.x, object.end.x) + tolerance;
    const minY = Math.min(object.start.y, object.end.y) - tolerance;
    const maxY = Math.max(object.start.y, object.end.y) + tolerance;
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }
  const origin = object.point;
  return distance(origin, point) <= ("size" in object ? object.size : 80) + tolerance;
}

function distance(first: LayoutPoint, second: LayoutPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function distanceToSegment(point: LayoutPoint, start: LayoutPoint, end: LayoutPoint) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (!lengthSquared) return distance(point, start);
  const ratio = clamp(((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y) });
}

function saveStateLabel(value: Props["saveState"]) {
  return { saved: "Saved", saving: "Saving…", offline: "Offline draft", error: "Save failed", conflict: "Conflict—draft preserved" }[value];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "layout";
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
