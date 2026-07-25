export type LayoutTool =
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "text"
  | "dimension"
  | "room"
  | "door"
  | "stairs"
  | "transition"
  | "pan";

export type LayoutPoint = {
  x: number;
  y: number;
  pressure?: number;
};

type BaseLayoutObject = {
  id: string;
  color: string;
  thickness: number;
};

export type LayoutObject =
  | (BaseLayoutObject & { type: "stroke"; points: LayoutPoint[] })
  | (BaseLayoutObject & { type: "line"; start: LayoutPoint; end: LayoutPoint })
  | (BaseLayoutObject & { type: "rectangle"; start: LayoutPoint; end: LayoutPoint })
  | (BaseLayoutObject & {
      type: "text" | "room";
      point: LayoutPoint;
      text: string;
      fontSize: number;
    })
  | (BaseLayoutObject & {
      type: "dimension";
      start: LayoutPoint;
      end: LayoutPoint;
      label: string;
    })
  | (BaseLayoutObject & {
      type: "symbol";
      symbol: "door" | "stairs" | "transition";
      point: LayoutPoint;
      size: number;
    });

export type LayoutPage = {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  showGrid: boolean;
  objects: LayoutObject[];
};

export type LayoutDocument = {
  version: 1;
  activePageId: string;
  pages: LayoutPage[];
};

export type JobLayout = {
  id: string;
  job_id: string;
  name: string;
  document_data: LayoutDocument;
  page_count: number;
  preview_storage_path: string | null;
  preview_url: string | null;
  created_by_employee_id: string | null;
  updated_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  created_by: { id: string; name: string } | null;
  updated_by: { id: string; name: string } | null;
};

export type LayoutTemplate = "blank" | "grid" | "room";

export function createLayoutDocument(template: LayoutTemplate = "grid"): LayoutDocument {
  const pageId = crypto.randomUUID();
  const page: LayoutPage = {
    id: pageId,
    name: "Page 1",
    width: 1400,
    height: 900,
    gridSize: 25,
    showGrid: template !== "blank",
    objects: [],
  };

  if (template === "room") {
    page.objects.push(
      {
        id: crypto.randomUUID(),
        type: "rectangle",
        start: { x: 250, y: 180 },
        end: { x: 1150, y: 720 },
        color: "#111827",
        thickness: 4,
      },
      {
        id: crypto.randomUUID(),
        type: "room",
        point: { x: 610, y: 430 },
        text: "Room",
        fontSize: 32,
        color: "#111827",
        thickness: 2,
      },
    );
  }

  return { version: 1, activePageId: pageId, pages: [page] };
}
