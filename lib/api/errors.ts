import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "payload_too_large"
  | "rate_limited"
  | "workspace_required"
  | "workspace_not_assigned"
  | "scope_required"
  | "conflict"
  | "internal_error";

const statusByCode: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 400,
  payload_too_large: 413,
  rate_limited: 429,
  workspace_required: 400,
  workspace_not_assigned: 403,
  scope_required: 403,
  conflict: 409,
  internal_error: 500
};

export class ApiError extends Error {
  code: ErrorCode;
  details?: unknown;
  status: number;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = statusByCode[code];
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? {}
        }
      },
      { status: error.status }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Internal server error.",
        details: {}
      }
    },
    { status: 500 }
  );
}

export async function withApi<T extends Response>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}
