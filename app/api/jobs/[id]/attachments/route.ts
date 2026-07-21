import { NextResponse } from "next/server";
import type { AttachmentKind } from "@/components/attachments/types";
import { uploadJobAttachment } from "@/lib/services/job-attachments";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind");
    const category = formData.get("category");
    const description = formData.get("description");

    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (kind !== "photo" && kind !== "file") return NextResponse.json({ error: "Invalid attachment type." }, { status: 400 });
    if (typeof category !== "string" || !category.trim()) return NextResponse.json({ error: "Choose a category." }, { status: 400 });

    const attachment = await uploadJobAttachment({
      jobId: id,
      file,
      kind: kind as AttachmentKind,
      category: category.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload attachment.";
    const status = message.includes("permission") || message.includes("login") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
