import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  removeManagedEmployeeAvatar,
  uploadManagedEmployeeAvatar,
} from "@/lib/services/employee-admin";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose an employee photo." },
        { status: 400 },
      );
    }

    const employee = await uploadManagedEmployeeAvatar(id, file);
    revalidatePath("/", "layout");
    revalidatePath("/settings/employees");
    return NextResponse.json({ employee });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload the employee photo.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const employee = await removeManagedEmployeeAvatar(id);
    revalidatePath("/", "layout");
    revalidatePath("/settings/employees");
    return NextResponse.json({ employee });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove the employee photo.",
      },
      { status: 400 },
    );
  }
}
