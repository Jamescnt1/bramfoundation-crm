import type { LayoutObject, LayoutPage, LayoutPoint } from "@/components/layouts/types";

const imageCache = new Map<string, HTMLImageElement>();

export function renderLayoutPage(
  context: CanvasRenderingContext2D,
  page: LayoutPage,
  options: { includeGrid?: boolean; onImageLoad?: () => void } = {},
) {
  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.width, page.height);
  if (options.includeGrid !== false && page.showGrid && page.gridSize > 0) drawGrid(context, page);
  for (const object of page.objects) drawObject(context, object, options.onImageLoad);
  context.restore();
}

export function drawObject(
  context: CanvasRenderingContext2D,
  object: LayoutObject,
  onImageLoad?: () => void,
) {
  const bounds = getObjectBounds(object);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  context.save();
  context.globalAlpha = object.opacity;
  context.translate(center.x, center.y);
  context.rotate((object.rotation * Math.PI) / 180);
  context.scale(object.scaleX, object.scaleY);
  context.translate(-center.x, -center.y);
  context.strokeStyle = object.color;
  context.fillStyle = object.color;
  context.lineWidth = object.thickness;
  context.lineCap = object.type === "stroke" && object.strokeKind === "highlighter" ? "butt" : "round";
  context.lineJoin = "round";

  if (object.type === "stroke") {
    if (object.points.length >= 2) {
      context.beginPath();
      context.moveTo(object.points[0].x, object.points[0].y);
      for (let index = 1; index < object.points.length; index += 1) {
        context.lineTo(object.points[index].x, object.points[index].y);
      }
      context.stroke();
    }
  } else if (object.type === "line") {
    line(context, object.start, object.end);
  } else if (object.type === "rectangle") {
    context.strokeRect(
      Math.min(object.start.x, object.end.x),
      Math.min(object.start.y, object.end.y),
      Math.abs(object.end.x - object.start.x),
      Math.abs(object.end.y - object.start.y),
    );
  } else if (object.type === "text" || object.type === "room") {
    context.font = `${object.type === "room" ? "600 " : ""}${object.fontSize}px system-ui, sans-serif`;
    context.textBaseline = "top";
    context.fillText(object.text, object.point.x, object.point.y);
  } else if (object.type === "dimension") {
    line(context, object.start, object.end);
    const angle = Math.atan2(object.end.y - object.start.y, object.end.x - object.start.x);
    tick(context, object.start, angle);
    tick(context, object.end, angle);
    const middle = { x: (object.start.x + object.end.x) / 2, y: (object.start.y + object.end.y) / 2 };
    context.font = "600 20px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillStyle = "#ffffff";
    const width = context.measureText(object.label).width + 12;
    context.fillRect(middle.x - width / 2, middle.y - 27, width, 27);
    context.fillStyle = object.color;
    context.fillText(object.label, middle.x, middle.y - 4);
  } else if (object.type === "symbol") {
    drawSymbol(context, object.symbol, object.point, object.size);
  } else if (object.type === "photo") {
    const image = getImage(object.dataUrl, onImageLoad);
    if (image.complete && image.naturalWidth) {
      context.globalAlpha = object.opacity;
      context.drawImage(image, object.point.x, object.point.y, object.width, object.height);
    } else {
      context.fillStyle = "#e5e7eb";
      context.fillRect(object.point.x, object.point.y, object.width, object.height);
      context.fillStyle = "#6b7280";
      context.font = "16px system-ui, sans-serif";
      context.fillText("Loading photo…", object.point.x + 16, object.point.y + 24);
    }
  }
  context.restore();
}

export async function renderPageToCanvas(page: LayoutPage, maximumWidth?: number) {
  await preloadPageImages(page);
  const scale = maximumWidth ? Math.min(1, maximumWidth / page.width) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.scale(scale, scale);
  renderLayoutPage(context, page);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to render the layout.")), type, quality);
  });
}

export function getObjectBounds(object: LayoutObject) {
  let bounds: { x: number; y: number; width: number; height: number };
  if (object.type === "stroke") {
    bounds = boundsFromPoints(object.points);
  } else if (object.type === "line" || object.type === "rectangle" || object.type === "dimension") {
    bounds = boundsFromPoints([object.start, object.end]);
  } else if (object.type === "photo") {
    bounds = { x: object.point.x, y: object.point.y, width: object.width, height: object.height };
  } else if ("fontSize" in object) {
    bounds = {
      x: object.point.x,
      y: object.point.y,
      width: Math.max(40, object.text.length * object.fontSize * 0.58),
      height: object.fontSize * 1.25,
    };
  } else {
    bounds = {
      x: object.point.x - object.size / 2,
      y: object.point.y - object.size / 2,
      width: object.size,
      height: object.size,
    };
  }
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const scaledWidth = bounds.width * Math.abs(object.scaleX);
  const scaledHeight = bounds.height * Math.abs(object.scaleY);
  const angle = (object.rotation * Math.PI) / 180;
  const width = Math.abs(Math.cos(angle)) * scaledWidth + Math.abs(Math.sin(angle)) * scaledHeight;
  const height = Math.abs(Math.sin(angle)) * scaledWidth + Math.abs(Math.cos(angle)) * scaledHeight;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

export async function preloadPageImages(page: LayoutPage) {
  await Promise.all(page.objects.filter((object) => object.type === "photo").map((object) => loadImage(object.dataUrl)));
}

function getImage(source: string, onLoad?: () => void) {
  let image = imageCache.get(source);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = source;
    imageCache.set(source, image);
  }
  if (onLoad && !image.complete) image.addEventListener("load", onLoad, { once: true });
  return image;
}

function loadImage(source: string) {
  const image = getImage(source);
  if (image.complete && image.naturalWidth) return Promise.resolve(image);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Unable to load an inserted photo.")), { once: true });
  });
}

function drawGrid(context: CanvasRenderingContext2D, page: LayoutPage) {
  context.beginPath();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 1;
  for (let x = 0; x <= page.width; x += page.gridSize) {
    context.moveTo(x, 0);
    context.lineTo(x, page.height);
  }
  for (let y = 0; y <= page.height; y += page.gridSize) {
    context.moveTo(0, y);
    context.lineTo(page.width, y);
  }
  context.stroke();
}

function line(context: CanvasRenderingContext2D, start: LayoutPoint, end: LayoutPoint) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function tick(context: CanvasRenderingContext2D, point: LayoutPoint, angle: number) {
  const normal = angle + Math.PI / 2;
  const size = 10;
  line(
    context,
    { x: point.x - Math.cos(normal) * size, y: point.y - Math.sin(normal) * size },
    { x: point.x + Math.cos(normal) * size, y: point.y + Math.sin(normal) * size },
  );
}

function drawSymbol(
  context: CanvasRenderingContext2D,
  symbol: "door" | "stairs" | "transition",
  point: LayoutPoint,
  size: number,
) {
  if (symbol === "door") {
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + size, point.y);
    context.arc(point.x, point.y, size, 0, Math.PI / 2);
    context.stroke();
  } else if (symbol === "stairs") {
    const step = size / 5;
    context.beginPath();
    for (let index = 0; index < 5; index += 1) context.rect(point.x, point.y + index * step, size, step);
    context.stroke();
  } else {
    context.setLineDash([8, 6]);
    line(context, { x: point.x - size / 2, y: point.y }, { x: point.x + size / 2, y: point.y });
    context.setLineDash([]);
    context.font = "600 14px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("TRANSITION", point.x, point.y - 8);
  }
}

function boundsFromPoints(points: LayoutPoint[]) {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}
