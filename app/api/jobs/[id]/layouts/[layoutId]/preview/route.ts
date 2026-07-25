import { NextResponse } from "next/server";
import { uploadLayoutPreview } from "@/lib/services/job-layouts";

type Context = { params: Promise<{ id: string; layoutId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { id, layoutId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a preview image." }, { status: 400 });
    const result = await uploadLayoutPreview({ jobId: id, layoutId, file });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the layout preview.";
    const status = message.includes("permission") || message.includes("login") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
