import { redirect } from "next/navigation";

import { AccessPending } from "@/components/app-shell/access-pending";
import { DashboardClient, type DashboardData } from "@/components/app-shell/dashboard-client";
import { SetupRequired } from "@/components/app-shell/setup-required";
import { ensureUserAccess } from "@/lib/auth/access";
import { supabasePublishableKey, supabaseSecretKey } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = createSupabaseServiceClient();
  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("role, organizations(id, public_id, name, slug, status, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const organizations =
    memberships?.map((row) => ({
      role: row.role,
      ...(Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations)
    })) ?? [];
  const selectedOrg = organizations[0];
  const { data: access } = await supabase
    .from("user_access")
    .select("is_platform_admin")
    .eq("user_id", userId)
    .maybeSingle<{ is_platform_admin: boolean }>();
  let signupRequests: DashboardData["signupRequests"] = [];

  if (access?.is_platform_admin) {
    const { data: requests } = await supabase
      .from("user_access")
      .select("public_id, email, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    signupRequests = requests ?? [];
  }

  if (!selectedOrg) {
    return {
      organizations,
      workspaces: [],
      todos: [],
      files: [],
      isPlatformAdmin: access?.is_platform_admin ?? false,
      signupRequests
    };
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, public_id, name, slug, status, created_at")
    .eq("organization_id", selectedOrg.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const selectedWorkspace = workspaces?.[0];

  if (!selectedWorkspace) {
    return {
      organizations,
      workspaces: workspaces ?? [],
      todos: [],
      files: [],
      isPlatformAdmin: access?.is_platform_admin ?? false,
      signupRequests
    };
  }

  const [{ data: todos }, { data: files }] = await Promise.all([
    supabase
      .from("todos")
      .select(
        "id, public_id, title, description, status, priority, source, external_id, labels, created_at, updated_at"
      )
      .eq("workspace_id", selectedWorkspace.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("files")
      .select(
        "id, public_id, filename, kind, content_type, size_bytes, visibility, created_at"
      )
      .eq("workspace_id", selectedWorkspace.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(25)
  ]);

  return {
    organizations,
    workspaces: workspaces ?? [],
    todos: todos ?? [],
    files: files ?? [],
    isPlatformAdmin: access?.is_platform_admin ?? false,
    signupRequests
  };
}

export default async function AppPage() {
  if (!supabasePublishableKey || !supabaseSecretKey) {
    return <SetupRequired />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const access = await ensureUserAccess(serviceSupabase, user);

  if (access.status === "pending" || access.status === "rejected") {
    return <AccessPending email={access.email} status={access.status} />;
  }

  let data: DashboardData;
  let setupError: string | null = null;

  try {
    data = await getDashboardData(user.id);
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Unknown setup error.";
    data = {
      organizations: [],
      workspaces: [],
      todos: [],
      files: [],
      isPlatformAdmin: access.is_platform_admin,
      signupRequests: []
    };
  }

  return <DashboardClient data={data} email={user.email ?? ""} setupError={setupError} />;
}
