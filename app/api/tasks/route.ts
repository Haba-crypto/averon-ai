export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  listTasks,
  updateTaskStatus,
  type TaskExecutionStatus,
} from "@/lib/application/tasks/tasks-service";
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
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    const body = await req.json();
    const { taskId, status } = body;

    const allowedStatuses =
      new Set<TaskExecutionStatus>([
        "approved",
        "completed",
        "escalated",
        "blocked",
        "superseded",
        "archived",
      ]);

    if (
      typeof taskId !== "string" ||
      typeof status !== "string" ||
      !allowedStatuses.has(status as TaskExecutionStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "taskId and supported task status are required",
        },
        {
          status: 400,
        }
      );
    }

    const task =
      status === "completed"
        ? await updateTaskStatus({
            supabase,
            taskId,
            status: "completed",
            organizationId,
          })
        : await updateTaskStatus({
            supabase,
            taskId,
            status: status as TaskExecutionStatus,
            organizationId,
          });

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
