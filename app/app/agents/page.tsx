import { redirect } from "next/navigation";

import {
  AgentsClient,
  type AgentsPageData
} from "@/components/app-shell/agents-client";
import { AccessPending } from "@/components/app-shell/access-pending";
import { SetupRequired } from "@/components/app-shell/setup-required";
import { ensureUserAccess } from "@/lib/auth/access";
import { supabasePublishableKey, supabaseSecretKey } from "@/lib/config/env";
import { listAgentsWithWorkspaceAssignments } from "@/lib/core/agents";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export const dynamic = "force-dynamic";

async function getAgentsPageData(userId: string): Promise<AgentsPageData> {
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
      agents: []
    };
  }

  const [{ data: workspaces }, agents] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, public_id, name, slug, status, created_at")
      .eq("organization_id", selectedOrg.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    listAgentsWithWorkspaceAssignments(supabase, selectedOrg.id)
  ]);

  return {
    organizations,
    workspaces: workspaces ?? [],
    agents
  };
}

export default async function AgentsPage() {
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

  let data: AgentsPageData;
  let setupError: string | null = null;

  try {
    data = await getAgentsPageData(user.id);
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Unknown setup error.";
    data = {
      organizations: [],
      workspaces: [],
      agents: []
    };
  }

  return <AgentsClient data={data} email={user.email ?? ""} setupError={setupError} />;
}
