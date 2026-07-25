import { NextResponse } from "next/server";
import { importJobLayout } from "@/lib/services/job-layouts";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a layout file." }, { status: 400 });
    }

    const result = await importJobLayout({
      jobId: id,
      file,
      name: stringValue(formData.get("layoutName")),
      roomOrArea: optionalString(formData.get("roomOrArea")),
      notes: optionalString(formData.get("notes")),
      replaceLayoutId: optionalString(formData.get("replaceLayoutId")),
    });
    return NextResponse.json({ layout: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import the layout.";
    const status = message.toLowerCase().includes("permission") || message.toLowerCase().includes("login") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function optionalString(value: FormDataEntryValue | null) {
  const clean = stringValue(value).trim();
  return clean || null;
}
