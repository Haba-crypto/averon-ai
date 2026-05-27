import { NextResponse } from "next/server";

import { Resend } from "resend";

import { jsonError, methodNotAllowed } from "@/lib/api/errors";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function GET() {
  return methodNotAllowed("GET");
}

export async function POST() {

  try {

    const response =
      await resend.emails.send({

        from:
          "AVERON <onboarding@resend.dev>",

        to:
          "mihajlukristina@gmail.com",

        subject:
          "AVERON AI TEST",

        html: `
          <div style="background:black;padding:40px;color:white;font-family:sans-serif;">
            <h1>AVERON AI</h1>
            <p>Email system operational.</p>
          </div>
        `,
      });

    return NextResponse.json({
      success: true,
      response,
    });

  } catch (error: unknown) {

    return jsonError(error);

  }

}
