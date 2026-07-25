export type LayoutTool =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "rectangle"
  | "text"
  | "dimension"
  | "room"
  | "transition"
  | "photo"
  | "pan";

export type LayoutOrientation = "portrait" | "landscape";
export type LayoutGridSize = 0 | 15 | 25 | 50;

export type LayoutPoint = {
  x: number;
  y: number;
  pressure?: number;
};

type BaseLayoutObject = {
  id: string;
  color: string;
  thickness: number;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  locked: boolean;
};

export type LayoutObject =
  | (BaseLayoutObject & {
      type: "stroke";
      strokeKind: "pen" | "highlighter";
      points: LayoutPoint[];
    })
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
    })
  | (BaseLayoutObject & {
      type: "photo";
      point: LayoutPoint;
      width: number;
      height: number;
      dataUrl: string;
      fileName: string;
    });

export type LayoutPage = {
  id: string;
  name: string;
  width: number;
  height: number;
  orientation: LayoutOrientation;
  gridSize: LayoutGridSize;
  showGrid: boolean;
  snapToGrid: boolean;
  objects: LayoutObject[];
};

export type LayoutDocument = {
  version: 2;
  activePageId: string;
  pages: LayoutPage[];
};

type LegacyLayoutObject = Omit<LayoutObject, keyof BaseLayoutObject> &
  Partial<BaseLayoutObject> & { type: LayoutObject["type"]; strokeKind?: "pen" | "highlighter" };

type LegacyLayoutDocument = {
  version?: number;
  activePageId: string;
  pages: Array<Omit<LayoutPage, "orientation" | "snapToGrid" | "objects"> & {
    orientation?: LayoutOrientation;
    snapToGrid?: boolean;
    objects: LegacyLayoutObject[];
  }>;
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
  attachment_id: string | null;
  room_or_area: string | null;
  notes: string | null;
  record_kind: "legacy_drawing" | "imported_file";
  version_number: number;
  supersedes_layout_id: string | null;
  is_latest: boolean;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_url: string | null;
  created_by: { id: string; name: string } | null;
  updated_by: { id: string; name: string } | null;
};

export type LayoutTemplate = "blank" | "grid" | "room";

const DEFAULT_OBJECT = {
  color: "#111827",
  thickness: 4,
  opacity: 1,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  locked: false,
} satisfies Omit<BaseLayoutObject, "id">;

export function createObjectBase(
  input: Partial<Omit<BaseLayoutObject, "id">> = {},
): BaseLayoutObject {
  return { id: crypto.randomUUID(), ...DEFAULT_OBJECT, ...input };
}

export function createLayoutDocument(
  template: LayoutTemplate = "grid",
  orientation: LayoutOrientation = "portrait",
): LayoutDocument {
  const pageId = crypto.randomUUID();
  const portrait = orientation === "portrait";
  const page: LayoutPage = {
    id: pageId,
    name: "Page 1",
    width: portrait ? 900 : 1400,
    height: portrait ? 1400 : 900,
    orientation,
    gridSize: 25,
    showGrid: template !== "blank",
    snapToGrid: true,
    objects: [],
  };

  if (template === "room") {
    const marginX = portrait ? 140 : 250;
    const marginY = portrait ? 250 : 180;
    page.objects.push(
      {
        ...createObjectBase(),
        type: "rectangle",
        start: { x: marginX, y: marginY },
        end: { x: page.width - marginX, y: page.height - marginY },
      },
      {
        ...createObjectBase({ thickness: 2 }),
        type: "room",
        point: { x: page.width / 2 - 45, y: page.height / 2 - 16 },
        text: "Room",
        fontSize: 32,
      },
    );
  }

  return { version: 2, activePageId: pageId, pages: [page] };
}

export function normalizeLayoutDocument(value: LayoutDocument | LegacyLayoutDocument): LayoutDocument {
  const pages = value.pages.map((page) => {
    const orientation = page.orientation ?? (page.height >= page.width ? "portrait" : "landscape");
    return {
      ...page,
      orientation,
      gridSize: normalizeGridSize(page.gridSize),
      showGrid: Boolean(page.showGrid),
      snapToGrid: page.snapToGrid ?? true,
      objects: page.objects.map((object) => ({
        ...DEFAULT_OBJECT,
        ...object,
        strokeKind: object.type === "stroke" ? object.strokeKind ?? "pen" : undefined,
      })) as LayoutObject[],
    };
  });
  return { version: 2, activePageId: value.activePageId, pages };
}

function normalizeGridSize(value: number): LayoutGridSize {
  if (value === 0 || value === 15 || value === 25 || value === 50) return value;
  if (value <= 20) return 15;
  if (value <= 37) return 25;
  return 50;
}
