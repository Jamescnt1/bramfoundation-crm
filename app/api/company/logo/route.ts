import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { removeCompanyLogo, uploadCompanyLogo } from "@/lib/services/company-settings";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const id = formData.get("id");
    const file = formData.get("file");
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Company settings were not found." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a company logo." }, { status: 400 });
    }

    const settings = await uploadCompanyLogo(id, file);
    revalidatePath("/", "layout");
    revalidatePath("/settings/company");
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload the company logo." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Company settings were not found." }, { status: 400 });

    const settings = await removeCompanyLogo(id);
    revalidatePath("/", "layout");
    revalidatePath("/settings/company");
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove the company logo." },
      { status: 400 },
    );
  }
}
