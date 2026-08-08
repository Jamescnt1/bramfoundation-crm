import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import { updateJob, type UpdateJobValues } from "@/lib/services/jobs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("jobs.manage");
    const { id } = await context.params;
    const values = (await request.json()) as UpdateJobValues;
    const job = await updateJob(id, values);

    revalidatePath(`/leads/${id}`);
    revalidatePath(`/leads/${id}/edit`);
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    revalidatePath("/customers");

    return Response.json({ job });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the job.",
      },
      { status: 400 },
    );
  }
}
