import type { LayoutObject, LayoutPage, LayoutPoint } from "@/components/layouts/types";

export function renderLayoutPage(
  context: CanvasRenderingContext2D,
  page: LayoutPage,
  options: { includeGrid?: boolean } = {},
) {
  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.width, page.height);
  if (options.includeGrid !== false && page.showGrid) drawGrid(context, page);
  for (const object of page.objects) drawObject(context, object);
  context.restore();
}

export function drawObject(context: CanvasRenderingContext2D, object: LayoutObject) {
  context.save();
  context.strokeStyle = object.color;
  context.fillStyle = object.color;
  context.lineWidth = object.thickness;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (object.type === "stroke") {
    if (object.points.length < 2) return context.restore();
    context.beginPath();
    context.moveTo(object.points[0].x, object.points[0].y);
    for (let index = 1; index < object.points.length; index += 1) {
      const point = object.points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
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
  }
  context.restore();
}

export function renderPageToCanvas(page: LayoutPage, maximumWidth?: number) {
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
    for (let index = 0; index < 5; index += 1) {
      context.rect(point.x, point.y + index * step, size, step);
    }
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
