import { NextResponse } from "next/server";

export function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong";
}

export function jsonError(
  error: unknown,
  status = 500
) {
  return NextResponse.json(
    {
      success: false,
      error: getErrorMessage(error),
    },
    {
      status,
    }
  );
}

export function methodNotAllowed(method: string) {
  return NextResponse.json(
    {
      success: false,
      error: `${method} is not allowed for this endpoint`,
    },
    {
      status: 405,
    }
  );
}
