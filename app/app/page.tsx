import { redirect } from "next/navigation";

import { DashboardClient, type DashboardData } from "@/components/app-shell/dashboard-client";
import { SetupRequired } from "@/components/app-shell/setup-required";
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

  if (!selectedOrg) {
    return {
      organizations,
      workspaces: [],
      agents: [],
      todos: [],
      files: []
    };
  }

  const [{ data: workspaces }, { data: agents }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, public_id, name, slug, status, created_at")
      .eq("organization_id", selectedOrg.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("agents")
      .select("id, public_id, name, kind, status, created_at")
      .eq("organization_id", selectedOrg.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
  ]);
  const selectedWorkspace = workspaces?.[0];

  if (!selectedWorkspace) {
    return {
      organizations,
      workspaces: workspaces ?? [],
      agents: agents ?? [],
      todos: [],
      files: []
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
    agents: agents ?? [],
    todos: todos ?? [],
    files: files ?? []
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

  let data: DashboardData;
  let setupError: string | null = null;

  try {
    data = await getDashboardData(user.id);
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Unknown setup error.";
    data = {
      organizations: [],
      workspaces: [],
      agents: [],
      todos: [],
      files: []
    };
  }

  return <DashboardClient data={data} email={user.email ?? ""} setupError={setupError} />;
}
