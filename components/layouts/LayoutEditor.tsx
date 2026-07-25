"use client";

import {
  BringToFront,
  Camera,
  Copy,
  Download,
  Eraser,
  Expand,
  FileDown,
  Grid3X3,
  Highlighter,
  ImagePlus,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  SendToBack,
  Shrink,
  Square,
  TextCursorInput,
  Trash2,
  Undo2,
  Unlock,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LayoutDocument,
  LayoutGridSize,
  LayoutObject,
  LayoutOrientation,
  LayoutPage,
  LayoutPoint,
  LayoutTool,
} from "@/components/layouts/types";
import { createObjectBase } from "@/components/layouts/types";
import {
  canvasToBlob,
  drawObject,
  getObjectBounds,
  renderLayoutPage,
  renderPageToCanvas,
} from "@/components/layouts/layout-renderer";
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

type Marquee = { start: LayoutPoint; end: LayoutPoint };
type Interaction = {
  pointerId: number;
  start: LayoutPoint;
  last: LayoutPoint;
  draft: LayoutObject | null;
  mode: "draw" | "erase" | "move" | "marquee";
  originalObjects?: LayoutObject[];
};

const penColors = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];
const highlighterColors = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4"];
const widthOptions = [2, 4, 7, 11, 16];
const gridOptions: Array<{ label: string; value: LayoutGridSize }> = [
  { label: "Off", value: 0 },
  { label: "Small", value: 15 },
  { label: "Medium", value: 25 },
  { label: "Large", value: 50 },
];

export default function LayoutEditor(props: Props) {
  const { jobId, name, document, canManage, saveState, onDocumentChange, onPreview } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const interaction = useRef<Interaction | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const undoStack = useRef<LayoutDocument[]>([]);
  const redoStack = useRef<LayoutDocument[]>([]);
  const [tool, setTool] = useState<LayoutTool>("select");
  const [color, setColor] = useState(penColors[0]);
  const [highlighterColor, setHighlighterColor] = useState(highlighterColors[0]);
  const [toolWidths, setToolWidths] = useState({ pen: 4, highlighter: 16, eraser: 16 });
  const [zoom, setZoom] = useState(0.55);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [viewport, setViewport] = useState({ width: 900, height: 620 });
  const [draft, setDraft] = useState<LayoutObject | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [online, setOnline] = useState(true);
  const page = useMemo(
    () => document.pages.find((item) => item.id === document.activePageId) ?? document.pages[0],
    [document],
  );
  const selectedObjects = useMemo(
    () => page.objects.filter((object) => selectedIds.includes(object.id)),
    [page.objects, selectedIds],
  );
  const fitZoom = useMemo(
    () => clamp(
      Math.min(
        Math.max(1, viewport.width - 32) / page.width,
        Math.max(1, viewport.height - 32) / page.height,
      ),
      0.2,
      3,
    ),
    [page.height, page.width, viewport.height, viewport.width],
  );
  const effectiveZoom = zoomMode === "fit" ? fitZoom : zoom;
  const pageOffset = useMemo(
    () => ({
      x: (viewport.width - page.width * effectiveZoom) / 2,
      y: (viewport.height - page.height * effectiveZoom) / 2,
    }),
    [effectiveZoom, page.height, page.width, viewport.height, viewport.width],
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
    context.translate(pageOffset.x, pageOffset.y);
    context.scale(effectiveZoom, effectiveZoom);
    context.shadowColor = "rgba(0,0,0,.18)";
    context.shadowBlur = 12 / effectiveZoom;
    context.shadowOffsetY = 3 / effectiveZoom;
    renderLayoutPage(context, page, { onImageLoad: redraw });
    context.shadowColor = "transparent";
    if (draft) drawObject(context, draft, redraw);
    drawSelection(context, page.objects, selectedIds, effectiveZoom);
    if (marquee) drawMarquee(context, marquee, effectiveZoom);
    context.restore();
  }, [draft, effectiveZoom, marquee, page, pageOffset, selectedIds, viewport]);

  useEffect(() => redraw(), [redraw]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: isFullScreen
          ? Math.max(420, Math.floor(window.innerHeight - 116))
          : Math.max(460, Math.min(760, window.innerHeight - 245)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isFullScreen]);
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
    if (!isFullScreen) return;
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = previousOverflow;
    };
  }, [isFullScreen]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const previewCanvas = await renderPageToCanvas(page, 900);
        await onPreview(await canvasToBlob(previewCanvas));
      } catch {
        // Editable autosave is authoritative; preview generation is best effort.
      }
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [document, onPreview, page]);

  function commit(next: LayoutDocument, trackHistory = true) {
    if (!canManage) return;
    if (trackHistory) pushHistory();
    onDocumentChange(next);
  }

  function pushHistory() {
    undoStack.current.push(structuredClone(document));
    if (undoStack.current.length > 75) undoStack.current.shift();
    redoStack.current = [];
  }

  function updatePage(nextPage: LayoutPage, trackHistory = true) {
    commit({
      ...document,
      pages: document.pages.map((item) => item.id === nextPage.id ? nextPage : item),
    }, trackHistory);
  }

  function updatePageWithoutHistory(nextPage: LayoutPage) {
    onDocumentChange({
      ...document,
      pages: document.pages.map((item) => item.id === nextPage.id ? nextPage : item),
    });
  }

  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(structuredClone(document));
    onDocumentChange(previous);
    setSelectedIds([]);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(structuredClone(document));
    onDocumentChange(next);
    setSelectedIds([]);
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const raw = {
      x: (event.clientX - bounds.left - pageOffset.x) / effectiveZoom,
      y: (event.clientY - bounds.top - pageOffset.y) / effectiveZoom,
      pressure: event.pressure || undefined,
    };
    return page.snapToGrid && page.gridSize > 0 && !["pen", "highlighter", "eraser", "select"].includes(tool)
      ? {
          ...raw,
          x: Math.round(raw.x / page.gridSize) * page.gridSize,
          y: Math.round(raw.y / page.gridSize) * page.gridSize,
        }
      : raw;
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canManage) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      interaction.current = null;
      setDraft(null);
      const values = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y),
        zoom: effectiveZoom,
      };
      return;
    }
    const point = canvasPoint(event);
    if (tool === "select") {
      const hit = [...page.objects].reverse().find((object) => hitObject(object, point, 14 / effectiveZoom));
      if (hit) {
        const selection = event.shiftKey
          ? selectedIds.includes(hit.id)
            ? selectedIds.filter((id) => id !== hit.id)
            : [...selectedIds, hit.id]
          : selectedIds.includes(hit.id)
            ? selectedIds
            : [hit.id];
        setSelectedIds(selection);
        pushHistory();
        interaction.current = {
          pointerId: event.pointerId,
          start: point,
          last: point,
          draft: null,
          mode: "move",
          originalObjects: structuredClone(page.objects),
        };
      } else {
        if (!event.shiftKey) setSelectedIds([]);
        setMarquee({ start: point, end: point });
        interaction.current = { pointerId: event.pointerId, start: point, last: point, draft: null, mode: "marquee" };
      }
      return;
    }
    if (tool === "eraser") {
      pushHistory();
      const nextObjects = eraseStrokeParts(page.objects, point, toolWidths.eraser / effectiveZoom);
      updatePageWithoutHistory({ ...page, objects: nextObjects });
      interaction.current = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        draft: null,
        mode: "erase",
        originalObjects: nextObjects,
      };
      return;
    }
    if (tool === "text" || tool === "room") {
      const value = window.prompt(tool === "room" ? "Room label" : "Text label");
      if (value?.trim()) {
        updatePage({
          ...page,
          objects: [...page.objects, {
            ...createObjectBase({ color, thickness: 2 }),
            type: tool,
            point,
            text: value.trim(),
            fontSize: tool === "room" ? 30 : 22,
          }],
        });
      }
      return;
    }
    if (tool === "transition") {
      updatePage({
        ...page,
        objects: [...page.objects, {
          ...createObjectBase({ color, thickness: 3 }),
          type: "symbol",
          symbol: "transition",
          point,
          size: 100,
        }],
      });
      return;
    }
    if (tool === "photo") {
      photoInputRef.current?.click();
      return;
    }
    const object = makeDraft(tool, point, color, highlighterColor, toolWidths);
    if (!object) return;
    interaction.current = { pointerId: event.pointerId, start: point, last: point, draft: object, mode: "draw" };
    setDraft(object);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const values = [...pointers.current.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      setZoomMode("manual");
      setZoom(clamp(pinch.current.zoom * (distance / Math.max(1, pinch.current.distance)), 0.2, 3));
      return;
    }
    const current = interaction.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    current.last = point;
    if (current.mode === "erase") {
      const source = current.originalObjects ?? page.objects;
      const next = eraseStrokeParts(source, point, toolWidths.eraser / effectiveZoom);
      current.originalObjects = next;
      updatePageWithoutHistory({ ...page, objects: next });
      return;
    }
    if (current.mode === "move" && current.originalObjects) {
      const dx = point.x - current.start.x;
      const dy = point.y - current.start.y;
      const next = current.originalObjects.map((object) =>
        selectedIds.includes(object.id) && !object.locked ? moveObject(object, dx, dy) : object,
      );
      updatePageWithoutHistory({ ...page, objects: next });
      return;
    }
    if (current.mode === "marquee") {
      setMarquee({ start: current.start, end: point });
      return;
    }
    if (!current.draft) return;
    if (current.draft.type === "stroke") {
      current.draft = { ...current.draft, points: [...current.draft.points, point] };
    } else if ("end" in current.draft) {
      current.draft = { ...current.draft, end: point };
    }
    setDraft(current.draft);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const current = interaction.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "marquee") {
      const selectionBox = normalizeBox({ start: current.start, end: current.last });
      const matches = page.objects
        .filter((object) => boxesIntersect(selectionBox, getObjectBounds(object)))
        .map((object) => object.id);
      setSelectedIds(matches);
      setMarquee(null);
    } else if (current.draft) {
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

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setZoomMode("manual");
    setZoom(clamp(effectiveZoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.2, 3));
  }

  function changeSelected(action: (object: LayoutObject) => LayoutObject) {
    if (!selectedIds.length) return;
    updatePage({
      ...page,
      objects: page.objects.map((object) => selectedIds.includes(object.id) ? action(object) : object),
    });
  }

  function duplicateSelected() {
    if (!selectedObjects.length) return;
    const duplicates = selectedObjects.map((object) => ({
      ...moveObject(structuredClone(object), 24, 24),
      id: crypto.randomUUID(),
      locked: false,
    }));
    updatePage({ ...page, objects: [...page.objects, ...duplicates] });
    setSelectedIds(duplicates.map((object) => object.id));
  }

  function deleteSelected() {
    if (!selectedIds.length) return;
    updatePage({ ...page, objects: page.objects.filter((object) => !selectedIds.includes(object.id)) });
    setSelectedIds([]);
  }

  function bringSelectedForward() {
    if (!selectedIds.length) return;
    const selected = page.objects.filter((object) => selectedIds.includes(object.id));
    const rest = page.objects.filter((object) => !selectedIds.includes(object.id));
    updatePage({ ...page, objects: [...rest, ...selected] });
  }

  function sendSelectedBackward() {
    if (!selectedIds.length) return;
    const selected = page.objects.filter((object) => selectedIds.includes(object.id));
    const rest = page.objects.filter((object) => !selectedIds.includes(object.id));
    updatePage({ ...page, objects: [...selected, ...rest] });
  }

  async function insertPhoto(file: File | undefined) {
    if (!file) return;
    setExportMessage("");
    try {
      const photo = await preparePhoto(file);
      const maximumWidth = Math.min(page.width * 0.65, 700);
      const scale = Math.min(1, maximumWidth / photo.width);
      const width = photo.width * scale;
      const height = photo.height * scale;
      const object: LayoutObject = {
        ...createObjectBase(),
        type: "photo",
        point: { x: (page.width - width) / 2, y: (page.height - height) / 2 },
        width,
        height,
        dataUrl: photo.dataUrl,
        fileName: file.name || "Photo",
      };
      updatePage({ ...page, objects: [...page.objects, object] });
      setSelectedIds([object.id]);
      setTool("select");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Unable to add that photo.");
    }
  }

  function addPage() {
    const id = crypto.randomUUID();
    const nextPage: LayoutPage = {
      id,
      name: `Page ${document.pages.length + 1}`,
      width: page.width,
      height: page.height,
      orientation: page.orientation,
      gridSize: page.gridSize,
      showGrid: page.showGrid,
      snapToGrid: page.snapToGrid,
      objects: [],
    };
    commit({ ...document, activePageId: id, pages: [...document.pages, nextPage] });
  }

  function deletePage() {
    if (document.pages.length === 1 || !window.confirm(`Delete ${page.name}?`)) return;
    const pages = document.pages.filter((item) => item.id !== page.id);
    commit({ ...document, activePageId: pages[0].id, pages });
  }

  function changeOrientation(orientation: LayoutOrientation) {
    if (page.orientation === orientation) return;
    const nextWidth = page.height;
    const nextHeight = page.width;
    const scaleX = nextWidth / page.width;
    const scaleY = nextHeight / page.height;
    updatePage({
      ...page,
      orientation,
      width: nextWidth,
      height: nextHeight,
      objects: page.objects.map((object) => scaleObjectGeometry(object, scaleX, scaleY)),
    });
    setZoomMode("fit");
  }

  function toggleFullScreen() {
    if (isFullScreen) {
      setIsFullScreen(false);
      return;
    }
    setIsFullScreen(true);
    setZoomMode("fit");
  }

  async function exportFile(kind: "png" | "pdf", saveToFiles: boolean) {
    setExporting(true);
    setExportMessage("");
    try {
      const blob = kind === "png"
        ? await canvasToBlob(await renderPageToCanvas(page))
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

  const activeWidth = tool === "highlighter"
    ? toolWidths.highlighter
    : tool === "eraser"
      ? toolWidths.eraser
      : toolWidths.pen;

  return (
    <div
      ref={rootRef}
      className={`min-w-0 bg-white ${isFullScreen ? "fixed inset-0 z-[100] flex h-[100dvh] flex-col" : ""}`}
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void insertPhoto(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void insertPhoto(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white p-1.5">
        <ToolButton active={tool === "select"} label="Select" onClick={() => setTool("select")}><MousePointer2 /></ToolButton>
        <ToolButton active={tool === "pen"} label="Pen" onClick={() => setTool("pen")}>✎</ToolButton>
        <ToolButton active={tool === "highlighter"} label="Highlighter" onClick={() => setTool("highlighter")}><Highlighter /></ToolButton>
        <ToolButton active={tool === "eraser"} label="Eraser" onClick={() => setTool("eraser")}><Eraser /></ToolButton>
        <ToolButton active={tool === "line"} label="Line" onClick={() => setTool("line")}><Minus /></ToolButton>
        <ToolButton active={tool === "rectangle"} label="Rectangle" onClick={() => setTool("rectangle")}><Square /></ToolButton>
        <ToolButton active={tool === "text"} label="Text" onClick={() => setTool("text")}><TextCursorInput /></ToolButton>
        <ToolButton active={tool === "room"} label="Room Label" onClick={() => setTool("room")}>Room</ToolButton>
        <ToolButton active={tool === "dimension"} label="Dimension" onClick={() => setTool("dimension")}>↔</ToolButton>
        <ToolButton active={tool === "transition"} label="Transition" onClick={() => setTool("transition")}>T</ToolButton>
        <ToolButton active={tool === "photo"} label="Photo" onClick={() => photoInputRef.current?.click()}><ImagePlus /></ToolButton>
        <span className="mx-0.5 h-6 w-px bg-gray-200" />
        <button type="button" onClick={undo} className="tool-button" title="Undo"><Undo2 /></button>
        <button type="button" onClick={redo} className="tool-button" title="Redo"><Redo2 /></button>
        <button type="button" onClick={toggleFullScreen} className="tool-button ml-auto" title={isFullScreen ? "Exit full screen" : "Full screen"}>
          {isFullScreen ? <X /> : <Maximize2 />}
          <span className="hidden sm:inline">{isFullScreen ? "Exit Full Screen" : "Full Screen"}</span>
        </button>
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        {["pen", "line", "rectangle", "text", "room", "dimension", "transition"].includes(tool) ? (
          <>
            <span className="context-label">Color</span>
            {penColors.map((value) => (
              <ColorButton key={value} value={value} active={color === value} onClick={() => setColor(value)} />
            ))}
          </>
        ) : null}
        {tool === "highlighter" ? (
          <>
            <span className="context-label">Highlighter</span>
            {highlighterColors.map((value) => (
              <ColorButton key={value} value={value} active={highlighterColor === value} onClick={() => setHighlighterColor(value)} translucent />
            ))}
          </>
        ) : null}
        {["pen", "highlighter", "eraser", "line", "rectangle", "dimension"].includes(tool) ? (
          <>
            <span className="ml-1 context-label">{tool === "eraser" ? "Eraser size" : "Width"}</span>
            {widthOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (tool === "highlighter") setToolWidths((current) => ({ ...current, highlighter: value }));
                  else if (tool === "eraser") setToolWidths((current) => ({ ...current, eraser: value }));
                  else setToolWidths((current) => ({ ...current, pen: value }));
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-md border ${activeWidth === value ? "border-black bg-white ring-1 ring-black" : "border-gray-200 bg-white"}`}
                aria-label={`Width ${value}`}
              >
                <span className="rounded-full bg-gray-900" style={{ width: Math.min(18, value), height: Math.min(18, value) }} />
              </button>
            ))}
          </>
        ) : null}
        {tool === "photo" ? (
          <>
            <button type="button" className="context-button" onClick={() => photoInputRef.current?.click()}><ImagePlus /> Choose Photo</button>
            <button type="button" className="context-button" onClick={() => cameraInputRef.current?.click()}><Camera /> Take Photo</button>
          </>
        ) : null}
        {tool === "select" && selectedObjects.length ? (
          <>
            <span className="context-label">{selectedObjects.length} selected</span>
            <button type="button" className="context-button" onClick={duplicateSelected}><Copy /> Duplicate</button>
            <button type="button" className="context-button" onClick={() => changeSelected((object) => ({ ...object, rotation: object.rotation - 15 }))}><RotateCcw /> Rotate</button>
            <button type="button" className="context-button" onClick={() => changeSelected((object) => ({ ...object, rotation: object.rotation + 15 }))}><RotateCw /> Rotate</button>
            <button type="button" className="context-button" onClick={() => changeSelected((object) => ({ ...object, scaleX: object.scaleX * 0.9, scaleY: object.scaleY * 0.9 }))}><Shrink /> Smaller</button>
            <button type="button" className="context-button" onClick={() => changeSelected((object) => ({ ...object, scaleX: object.scaleX * 1.1, scaleY: object.scaleY * 1.1 }))}><Expand /> Larger</button>
            <button type="button" className="context-button" onClick={bringSelectedForward}><BringToFront /> Forward</button>
            <button type="button" className="context-button" onClick={sendSelectedBackward}><SendToBack /> Backward</button>
            <button type="button" className="context-button" onClick={() => changeSelected((object) => ({ ...object, locked: !object.locked }))}>
              {selectedObjects.every((object) => object.locked) ? <Unlock /> : <Lock />}
              {selectedObjects.every((object) => object.locked) ? "Unlock" : "Lock"}
            </button>
            <button type="button" className="context-button !text-red-700" onClick={deleteSelected}><Trash2 /> Object Delete</button>
          </>
        ) : null}
        {tool === "select" && !selectedObjects.length ? <span className="text-[11px] text-gray-500">Tap an object or drag a box to select several objects.</span> : null}
      </div>

      <div ref={viewportRef} className="relative w-full flex-1 overflow-hidden bg-gray-300" style={{ height: isFullScreen ? undefined : viewport.height }}>
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
          {Math.round(effectiveZoom * 100)}% · {saveStateLabel(saveState)}
        </div>
        <div className="absolute bottom-2 right-2 flex items-center overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => {
              setZoomMode("manual");
              setZoom(clamp(effectiveZoom - 0.1, 0.2, 3));
            }}
            className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-gray-700 hover:bg-gray-100"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomMode("fit");
            }}
            className="h-9 border-x border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomMode("manual");
              setZoom(clamp(effectiveZoom + 0.1, 0.2, 3));
            }}
            className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-gray-700 hover:bg-gray-100"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 bg-white p-1.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {document.pages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onDocumentChange({ ...document, activePageId: item.id })}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${item.id === page.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {item.name}
            </button>
          ))}
          {canManage ? <button type="button" onClick={addPage} className="tool-button" title="Add page"><Plus /></button> : null}
          {canManage && document.pages.length > 1 ? <button type="button" onClick={deletePage} className="tool-button text-red-600" title="Delete current page">×</button> : null}
          <select
            value={page.orientation}
            onChange={(event) => changeOrientation(event.target.value as LayoutOrientation)}
            className="ml-1 h-8 rounded-md border border-gray-300 bg-white px-2 text-[11px] font-semibold text-gray-700"
            aria-label="Page orientation"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <span className="ml-1 context-label"><Grid3X3 /> Grid</span>
          {gridOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updatePage({
                ...page,
                gridSize: option.value,
                showGrid: option.value === 0 ? false : page.showGrid,
                snapToGrid: option.value === 0 ? false : page.snapToGrid,
              })}
              className={`h-8 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold ${page.gridSize === option.value ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {option.label}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={page.showGrid}
              disabled={page.gridSize === 0}
              onChange={(event) => updatePage({ ...page, showGrid: event.target.checked })}
            />
            Show
          </label>
          <label className="flex items-center gap-1 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={page.snapToGrid}
              disabled={page.gridSize === 0}
              onChange={(event) => updatePage({ ...page, snapToGrid: event.target.checked })}
            />
            Snap
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" disabled={exporting} onClick={() => void exportFile("png", false)} className="export-button"><Download /> PNG</button>
          <button type="button" disabled={exporting} onClick={() => void exportFile("pdf", false)} className="export-button"><FileDown /> PDF</button>
          <button type="button" disabled={exporting || !online} onClick={() => void exportFile("png", true)} className="export-button"><Save /> Save PNG</button>
          <button type="button" disabled={exporting || !online} onClick={() => void exportFile("pdf", true)} className="export-button"><Save /> Save PDF</button>
        </div>
      </div>
      {exportMessage ? <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600">{exportMessage}</p> : null}
      <style jsx>{`
        :global(.tool-button) { display:inline-flex; min-height:2rem; min-width:2rem; align-items:center; justify-content:center; gap:.25rem; border-radius:.375rem; padding:.35rem .45rem; font-size:.68rem; font-weight:650; color:#4b5563; }
        :global(.tool-button:hover) { background:#f3f4f6; color:#111827; }
        :global(.tool-button svg), :global(.export-button svg), :global(.context-button svg), :global(.context-label svg) { width:.875rem; height:.875rem; }
        :global(.context-label) { display:inline-flex; align-items:center; gap:.25rem; font-size:.67rem; font-weight:700; color:#4b5563; }
        :global(.context-button) { display:inline-flex; min-height:2rem; align-items:center; gap:.3rem; border:1px solid #d1d5db; border-radius:.375rem; background:white; padding:.3rem .5rem; font-size:.68rem; font-weight:650; color:#374151; }
        :global(.export-button) { display:inline-flex; min-height:2rem; align-items:center; gap:.3rem; border:1px solid #d1d5db; border-radius:.375rem; padding:.3rem .5rem; font-size:.68rem; font-weight:650; color:#374151; }
        :global(.export-button:disabled) { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
}

function ToolButton(props: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={props.onClick} className={`tool-button ${props.active ? "!bg-black !text-white" : ""}`} title={props.label}>
      {props.children}<span className="hidden 2xl:inline">{props.label}</span>
    </button>
  );
}

function ColorButton(props: { value: string; active: boolean; onClick: () => void; translucent?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`h-7 w-7 rounded-full border-2 ${props.active ? "border-black" : "border-white ring-1 ring-gray-300"}`}
      style={{ backgroundColor: props.value, opacity: props.translucent ? 0.55 : 1 }}
      aria-label={`Use ${props.value}`}
    />
  );
}

function makeDraft(
  tool: LayoutTool,
  point: LayoutPoint,
  color: string,
  highlighterColor: string,
  widths: { pen: number; highlighter: number; eraser: number },
): LayoutObject | null {
  if (tool === "pen") {
    return { ...createObjectBase({ color, thickness: widths.pen }), type: "stroke", strokeKind: "pen", points: [point] };
  }
  if (tool === "highlighter") {
    return {
      ...createObjectBase({ color: highlighterColor, thickness: widths.highlighter, opacity: 0.38 }),
      type: "stroke",
      strokeKind: "highlighter",
      points: [point],
    };
  }
  const base = createObjectBase({ color, thickness: widths.pen });
  if (tool === "line") return { ...base, type: "line", start: point, end: point };
  if (tool === "rectangle") return { ...base, type: "rectangle", start: point, end: point };
  if (tool === "dimension") return { ...base, type: "dimension", start: point, end: point, label: "" };
  return null;
}

function eraseStrokeParts(objects: LayoutObject[], point: LayoutPoint, radius: number) {
  return objects.flatMap((object) => {
    if (object.type !== "stroke" || object.locked) return [object];
    if (!object.points.some((value, index) =>
      distance(value, point) <= radius ||
      (index > 0 && distanceToSegment(point, object.points[index - 1], value) <= radius)
    )) return [object];
    const segments: LayoutPoint[][] = [];
    let current: LayoutPoint[] = [];
    for (const value of object.points) {
      if (distance(value, point) > radius) {
        current.push(value);
      } else if (current.length) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
    }
    if (current.length > 1) segments.push(current);
    return segments.map((points) => ({ ...object, id: crypto.randomUUID(), points }));
  });
}

function moveObject(object: LayoutObject, dx: number, dy: number): LayoutObject {
  const move = (point: LayoutPoint) => ({ ...point, x: point.x + dx, y: point.y + dy });
  if (object.type === "stroke") return { ...object, points: object.points.map(move) };
  if (object.type === "line" || object.type === "rectangle" || object.type === "dimension") {
    return { ...object, start: move(object.start), end: move(object.end) };
  }
  return { ...object, point: move(object.point) };
}

function scaleObjectGeometry(object: LayoutObject, scaleX: number, scaleY: number): LayoutObject {
  const scale = (point: LayoutPoint) => ({ ...point, x: point.x * scaleX, y: point.y * scaleY });
  if (object.type === "stroke") return { ...object, points: object.points.map(scale) };
  if (object.type === "line" || object.type === "rectangle" || object.type === "dimension") {
    return { ...object, start: scale(object.start), end: scale(object.end) };
  }
  if (object.type === "photo") {
    return {
      ...object,
      point: scale(object.point),
      width: object.width * scaleX,
      height: object.height * scaleY,
    };
  }
  return { ...object, point: scale(object.point) };
}

function hitObject(object: LayoutObject, point: LayoutPoint, tolerance: number) {
  const bounds = getObjectBounds(object);
  const expanded = {
    x: bounds.x - tolerance,
    y: bounds.y - tolerance,
    width: bounds.width + tolerance * 2,
    height: bounds.height + tolerance * 2,
  };
  if (object.type === "stroke") return object.points.some((value) => distance(value, point) <= tolerance + object.thickness / 2);
  if (object.type === "line" || object.type === "dimension") return distanceToSegment(point, object.start, object.end) <= tolerance;
  return point.x >= expanded.x && point.x <= expanded.x + expanded.width && point.y >= expanded.y && point.y <= expanded.y + expanded.height;
}

function drawSelection(
  context: CanvasRenderingContext2D,
  objects: LayoutObject[],
  selectedIds: string[],
  zoom: number,
) {
  context.save();
  context.setLineDash([7 / zoom, 5 / zoom]);
  context.strokeStyle = "#2563eb";
  context.fillStyle = "#2563eb";
  context.lineWidth = 2 / zoom;
  for (const object of objects) {
    if (!selectedIds.includes(object.id)) continue;
    const bounds = getObjectBounds(object);
    context.strokeRect(bounds.x - 6 / zoom, bounds.y - 6 / zoom, bounds.width + 12 / zoom, bounds.height + 12 / zoom);
    context.fillRect(bounds.x + bounds.width - 4 / zoom, bounds.y + bounds.height - 4 / zoom, 8 / zoom, 8 / zoom);
  }
  context.restore();
}

function drawMarquee(context: CanvasRenderingContext2D, marquee: Marquee, zoom: number) {
  const bounds = normalizeBox(marquee);
  context.save();
  context.setLineDash([7 / zoom, 5 / zoom]);
  context.strokeStyle = "#2563eb";
  context.fillStyle = "rgba(37,99,235,.08)";
  context.lineWidth = 1.5 / zoom;
  context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.restore();
}

function normalizeBox(value: { start: LayoutPoint; end: LayoutPoint }) {
  return {
    x: Math.min(value.start.x, value.end.x),
    y: Math.min(value.start.y, value.end.y),
    width: Math.abs(value.end.x - value.start.x),
    height: Math.abs(value.end.y - value.start.y),
  };
}

function boxesIntersect(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y;
}

async function preparePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Photos must be 20 MB or smaller.");
  const source = URL.createObjectURL(file);
  try {
    const image = await loadBrowserImage(source);
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = window.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable.");
    context.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.72), width, height };
  } finally {
    URL.revokeObjectURL(source);
  }
}

function loadBrowserImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read that photo."));
    image.src = source;
  });
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
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
