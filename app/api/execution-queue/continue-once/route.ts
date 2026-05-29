export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/errors";
import {
  processControlledContinuation,
} from "@/lib/application/execution-queue/controlled-continuation";
import { ExecutionQueueEmptyError } from "@/lib/application/execution-queue/process-next-execution-queue-item";
import { requireApiOrganizationContext } from "@/lib/auth/organization";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ContinueOnceBody = {
  queue_item_id?: unknown;
};

export async function POST(req: Request) {
  try {
    const { response, organizationId } =
      await requireApiOrganizationContext();

    if (response) {
      return response;
    }

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization context not found",
        },
        {
          status: 403,
        }
      );
    }

    const body = await readJsonBody(req);
    const queueItemId = body.queue_item_id;

    if (
      queueItemId !== undefined &&
      queueItemId !== null &&
      typeof queueItemId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "queue_item_id must be a string when provided",
        },
        {
          status: 400,
        }
      );
    }

    const result = await processControlledContinuation({
      supabase: supabaseAdmin,
      organizationId,
      queueItemId:
        typeof queueItemId === "string" ? queueItemId : null,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof ExecutionQueueEmptyError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          processed_count: 0,
        },
        {
          status: 404,
        }
      );
    }

    return jsonError(error);
  }
}

async function readJsonBody(req: Request): Promise<ContinueOnceBody> {
  const text = await req.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as ContinueOnceBody;
}
