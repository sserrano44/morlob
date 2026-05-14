import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, withApi } from "@/lib/api/errors";
import { ensureUserAccess, getAllowlistEntry, normalizeEmail } from "@/lib/auth/access";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

export async function POST(request: Request) {
  return withApi(async () => {
    const input = signupSchema.parse(await request.json());
    const email = normalizeEmail(input.email);
    const supabase = createSupabaseServiceClient();
    const allowlistEntry = await getAllowlistEntry(supabase, email);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new ApiError("conflict", "An account already exists for this email.");
      }

      throw error;
    }

    const access = await ensureUserAccess(supabase, {
      id: data.user.id,
      email
    });

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email
      },
      access: {
        status: access.status,
        is_platform_admin: access.is_platform_admin,
        auto_approved: Boolean(allowlistEntry)
      }
    }, { status: 201 });
  });
}
