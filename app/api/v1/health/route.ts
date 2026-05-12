import { NextResponse } from "next/server";

import { env } from "@/lib/config/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "morlob",
    deployment_mode: env.MORLOB_DEPLOYMENT_MODE
  });
}
