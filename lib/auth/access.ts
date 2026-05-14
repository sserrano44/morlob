import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

export type UserAccessStatus = "pending" | "approved" | "rejected";

export type UserAccess = {
  id: string;
  public_id: string;
  user_id: string;
  email: string;
  status: UserAccessStatus;
  is_platform_admin: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailIsAllowedForSignup(
  email: string,
  allowedEmails: readonly string[]
) {
  return allowedEmails.length === 0 || allowedEmails.includes(normalizeEmail(email));
}

export async function getAllowlistEntry(
  supabase: SupabaseClient,
  email: string
) {
  const { data, error } = await supabase
    .from("signup_allowlist")
    .select("email, is_platform_admin")
    .eq("email", normalizeEmail(email))
    .maybeSingle<{ email: string; is_platform_admin: boolean }>();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureUserAccess(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
) {
  if (!user.email) {
    throw new ApiError("forbidden", "User account is missing an email address.");
  }

  const email = normalizeEmail(user.email);
  const { data: existing, error: existingError } = await supabase
    .from("user_access")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<UserAccess>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const allowlistEntry = await getAllowlistEntry(supabase, email);
  const status = allowlistEntry ? "approved" : "pending";
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_access")
    .insert({
      user_id: user.id,
      email,
      status,
      is_platform_admin: allowlistEntry?.is_platform_admin ?? false,
      approved_at: status === "approved" ? now : null
    })
    .select("*")
    .single<UserAccess>();

  if (error) {
    throw error;
  }

  return data;
}

export async function requireApprovedUserAccess(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
) {
  const access = await ensureUserAccess(supabase, user);

  if (access.status !== "approved") {
    throw new ApiError("forbidden", "Your account is pending admin approval.");
  }

  return access;
}

export async function requirePlatformAdmin(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
) {
  const access = await requireApprovedUserAccess(supabase, user);

  if (!access.is_platform_admin) {
    throw new ApiError("forbidden", "Platform admin access is required.");
  }

  return access;
}
