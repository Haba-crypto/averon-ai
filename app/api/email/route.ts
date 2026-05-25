import { NextResponse } from "next/server";

import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function GET() {

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

  } catch (error: any) {

    return NextResponse.json({
      success: false,
      error:
        error?.message,
    });

  }

}