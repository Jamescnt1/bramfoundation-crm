import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/services/employees";
import { getTasks } from "@/lib/services/tasks";

export async function GET() {
  await requireEmployee();

  try {
    const tasks = await getTasks({ historyOnly: true });
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load task history." },
      { status: 500 },
    );
  }
}
