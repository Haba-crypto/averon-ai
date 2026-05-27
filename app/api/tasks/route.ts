export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  completeTask,
  listTasks,
} from "@/lib/application/tasks/tasks-service";
import { requireApiUser } from "@/lib/auth/api";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

export async function GET() {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const tasks = await listTasks({
      supabase,
      organizationId,
    });

    return NextResponse.json({
      tasks,
    });
  } catch (error: unknown) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, response } = await requireApiUser();

    if (response) {
      return response;
    }

    const body = await req.json();
    const { taskId, status } = body;

    if (
      typeof taskId !== "string" ||
      status !== "completed"
    ) {
      return NextResponse.json(
        {
          error: "taskId and completed status are required",
        },
        {
          status: 400,
        }
      );
    }

    await completeTask({
      supabase,
      taskId,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
