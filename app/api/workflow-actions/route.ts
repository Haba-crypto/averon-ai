import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  executeWorkflowAction,
  type WorkflowAction,
} from "@/lib/application/workflow-actions/execute-workflow-action";
import { requireApiOrganizationContext } from "@/lib/auth/organization";

const workflowActions = new Set<WorkflowAction>([
  "approve",
  "run",
]);

export async function POST(req: Request) {
  try {
    const { supabase, response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    if (!organizationId) {
      return NextResponse.json(
        {
          error: "Organization context required",
        },
        {
          status: 403,
        }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch (error) {
      console.error("WORKFLOW ACTION INVALID JSON", {
        error,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow action payload",
        },
        {
          status: 400,
        }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow action payload is required",
        },
        {
          status: 400,
        }
      );
    }

    const payload =
      body as Record<string, unknown>;
    const { leadId, action, recommendation } =
      payload;

    if (
      typeof leadId !== "string" ||
      typeof action !== "string" ||
      !workflowActions.has(action as WorkflowAction) ||
      typeof recommendation !== "string" ||
      !recommendation.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "leadId, approve/run action, and recommendation are required",
        },
        {
          status: 400,
        }
      );
    }

    const result = await executeWorkflowAction({
      supabase,
      organizationId,
      leadId,
      action: action as WorkflowAction,
      recommendation,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error("WORKFLOW ACTION API ERROR", {
      error,
    });

    return jsonError(error);
  }
}
