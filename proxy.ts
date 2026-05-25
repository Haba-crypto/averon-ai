import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function proxy(
  request: NextRequest
) {

  const token =
    request.cookies.get(
      "sb-access-token"
    );

  const isAuthPage =
    request.nextUrl.pathname.startsWith(
      "/login"
    ) ||
    request.nextUrl.pathname.startsWith(
      "/signup"
    );

  const isDashboard =
    request.nextUrl.pathname.startsWith(
      "/dashboard"
    );

  if (
    !token &&
    isDashboard
  ) {

    return NextResponse.redirect(
      new URL(
        "/login",
        request.url
      )
    );

  }

  if (
    token &&
    isAuthPage
  ) {

    return NextResponse.redirect(
      new URL(
        "/dashboard",
        request.url
      )
    );

  }

  return NextResponse.next();

}