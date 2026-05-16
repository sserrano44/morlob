"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AgentWorkspaceAssignmentSummary,
  AgentWithWorkspaceAssignments
} from "@/lib/core/agents";

type Organization = {
  id: string;
  public_id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
};

type Workspace = {
  id: string;
  public_id: string;
  name: string;
  slug: string;
  status: string;
};

type Agent = AgentWithWorkspaceAssignments;

export type AgentsPageData = {
  organizations: Organization[];
  workspaces: Workspace[];
  agents: Agent[];
};

type Props = {
  data: AgentsPageData;
  email: string;
  setupError: string | null;
};

type AgentDraft = {
  name: string;
  kind: string;
  status: string;
};

type SecretState = {
  secret: string;
  agentName: string;
  workspaceName: string;
};

const defaultScopes = [
  "todos:read",
  "todos:write",
  "files:read",
  "files:write"
].join(", ");

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Request failed.");
  }

  return payload as T;
}

function buildDrafts(agents: Agent[]) {
  return Object.fromEntries(
    agents.map((agent) => [
      agent.public_id,
      {
        name: agent.name,
        kind: agent.kind,
        status: agent.status
      }
    ])
  );
}

function assignmentLabel(assignment: AgentWorkspaceAssignmentSummary) {
  return assignment.workspace.name || assignment.workspace.public_id;
}

export function AgentsClient({ data, email, setupError }: Props) {
  const [organizations, setOrganizations] = useState(data.organizations);
  const [workspaces, setWorkspaces] = useState(data.workspaces);
  const [agents, setAgents] = useState(data.agents);
  const [drafts, setDrafts] = useState<Record<string, AgentDraft>>(() =>
    buildDrafts(data.agents)
  );
  const [selectedOrgId, setSelectedOrgId] = useState(
    data.organizations[0]?.public_id ?? ""
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    data.workspaces[0]?.public_id ?? ""
  );
  const [agentName, setAgentName] = useState("");
  const [agentKind, setAgentKind] = useState("generic");
  const [keyName, setKeyName] = useState("Default workspace key");
  const [scopes, setScopes] = useState(defaultScopes);
  const [secret, setSecret] = useState<SecretState | null>(null);
  const [message, setMessage] = useState<string | null>(setupError);
  const [isPending, startTransition] = useTransition();

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.public_id === selectedOrgId),
    [organizations, selectedOrgId]
  );
  const selectedWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.public_id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces]
  );

  useEffect(() => {
    if (!selectedOrgId) {
      return;
    }

    startTransition(async () => {
      try {
        await reloadOrganization(selectedOrgId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load org.");
      }
    });
  }, [selectedOrgId]);

  function run(action: () => Promise<void>) {
    setMessage(null);
    setSecret(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Request failed.");
      }
    });
  }

  async function reloadOrganization(orgId: string) {
    const [workspacePayload, agentPayload] = await Promise.all([
      readJson<{ workspaces: Workspace[] }>(
        await fetch(`/api/v1/orgs/${orgId}/workspaces`)
      ),
      readJson<{ agents: Agent[] }>(await fetch(`/api/v1/orgs/${orgId}/agents`))
    ]);

    setWorkspaces(workspacePayload.workspaces);
    setAgents(agentPayload.agents);
    setDrafts(buildDrafts(agentPayload.agents));
    setSelectedWorkspaceId((current) => {
      if (workspacePayload.workspaces.some((workspace) => workspace.public_id === current)) {
        return current;
      }

      return workspacePayload.workspaces[0]?.public_id ?? "";
    });
  }

  function createAgent() {
    if (!selectedOrgId || !agentName) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ agent: Omit<Agent, "workspace_assignments"> }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: agentName, kind: agentKind || "generic" })
        })
      );

      setAgents((current) => [
        ...current,
        { ...payload.agent, workspace_assignments: [] }
      ]);
      setDrafts((current) => ({
        ...current,
        [payload.agent.public_id]: {
          name: payload.agent.name,
          kind: payload.agent.kind,
          status: payload.agent.status
        }
      }));
      setAgentName("");
      setAgentKind("generic");
    });
  }

  function updateDraft(agent: Agent, update: Partial<AgentDraft>) {
    setDrafts((current) => ({
      ...current,
      [agent.public_id]: {
        ...current[agent.public_id],
        ...update
      }
    }));
  }

  function saveAgent(agent: Agent) {
    const draft = drafts[agent.public_id];

    if (!selectedOrgId || !draft) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ agent: Omit<Agent, "workspace_assignments"> }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents/${agent.public_id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft)
        })
      );

      setAgents((current) =>
        current.map((item) =>
          item.public_id === agent.public_id
            ? { ...item, ...payload.agent, workspace_assignments: item.workspace_assignments }
            : item
        )
      );
    });
  }

  function deleteAgent(agent: Agent) {
    if (!selectedOrgId || !window.confirm(`Delete ${agent.name}?`)) {
      return;
    }

    run(async () => {
      await readJson<{ agent: Agent }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents/${agent.public_id}`, {
          method: "DELETE"
        })
      );
      setAgents((current) =>
        current.filter((item) => item.public_id !== agent.public_id)
      );
      setDrafts((current) => {
        const remaining = { ...current };
        delete remaining[agent.public_id];
        return remaining;
      });
    });
  }

  function assignAgent(agent: Agent) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      await readJson(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/agents/${agent.public_id}/workspace-assignments`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspace_id: selectedWorkspaceId })
          }
        )
      );
      await reloadOrganization(selectedOrgId);
    });
  }

  function unassignAgent(agent: Agent, assignment: AgentWorkspaceAssignmentSummary) {
    if (!selectedOrgId) {
      return;
    }

    run(async () => {
      await readJson(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/agents/${agent.public_id}/workspace-assignments/${assignment.workspace.public_id}`,
          { method: "DELETE" }
        )
      );
      await reloadOrganization(selectedOrgId);
    });
  }

  function generateKey(agent: Agent) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{
        secret: string;
        workspace: Workspace;
      }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents/${agent.public_id}/keys`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: keyName,
            workspace_id: selectedWorkspaceId,
            scopes: scopes
              .split(",")
              .map((scope) => scope.trim())
              .filter(Boolean)
          })
        })
      );

      setSecret({
        secret: payload.secret,
        agentName: agent.name,
        workspaceName: payload.workspace.name
      });
      await reloadOrganization(selectedOrgId);
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-5 py-5">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
          <div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/app">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal">Agents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {email}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              onChange={(event) => {
                const nextOrgId = event.target.value;
                setSelectedOrgId(nextOrgId);

                if (!nextOrgId) {
                  setWorkspaces([]);
                  setAgents([]);
                  setDrafts({});
                  setSelectedWorkspaceId("");
                }
              }}
              value={selectedOrgId}
            >
              <option value="">No organization</option>
              {organizations.map((org) => (
                <option key={org.public_id} value={org.public_id}>
                  {org.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              value={selectedWorkspaceId}
            >
              <option value="">No workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.public_id} value={workspace.public_id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            {message}
          </div>
        ) : null}

        {secret ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="font-medium">
                  Key for {secret.agentName} in {secret.workspaceName}
                </div>
                <div className="mt-1 break-all font-mono text-xs">{secret.secret}</div>
              </div>
              <Button
                onClick={() => navigator.clipboard.writeText(secret.secret)}
                type="button"
                variant="secondary"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4 text-primary" />
                Create agent
              </h2>
              <div className="mt-4 grid gap-2">
                <Input
                  disabled={!selectedOrgId}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="hermes"
                  value={agentName}
                />
                <Input
                  disabled={!selectedOrgId}
                  onChange={(event) => setAgentKind(event.target.value)}
                  placeholder="generic"
                  value={agentKind}
                />
                <Button
                  disabled={isPending || !agentName || !selectedOrgId}
                  onClick={createAgent}
                >
                  Create
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" />
                Key defaults
              </h2>
              <div className="mt-4 grid gap-2">
                <Input
                  onChange={(event) => setKeyName(event.target.value)}
                  value={keyName}
                />
                <Input
                  onChange={(event) => setScopes(event.target.value)}
                  value={scopes}
                />
                {selectedWorkspace ? (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Workspace: {selectedWorkspace.public_id}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedOrg ? selectedOrg.public_id : "No organization"}
              </div>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </div>

            {agents.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No agents yet.</Card>
            ) : null}

            {agents.map((agent) => {
              const draft = drafts[agent.public_id] ?? {
                name: agent.name,
                kind: agent.kind,
                status: agent.status
              };
              const alreadyAssigned = agent.workspace_assignments.some(
                (assignment) =>
                  assignment.workspace.public_id === selectedWorkspaceId
              );

              return (
                <Card className="p-4" key={agent.public_id}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <h2 className="text-base font-semibold">{agent.name}</h2>
                        <Badge tone={agent.status === "active" ? "success" : "default"}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">
                        {agent.public_id}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isPending}
                        onClick={() => saveAgent(agent)}
                        size="sm"
                        variant="secondary"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => deleteAgent(agent)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_160px]">
                    <Input
                      onChange={(event) =>
                        updateDraft(agent, { name: event.target.value })
                      }
                      value={draft.name}
                    />
                    <Input
                      onChange={(event) =>
                        updateDraft(agent, { kind: event.target.value })
                      }
                      value={draft.kind}
                    />
                    <select
                      className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                      onChange={(event) =>
                        updateDraft(agent, { status: event.target.value })
                      }
                      value={draft.status}
                    >
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      disabled={isPending || !selectedWorkspaceId || alreadyAssigned}
                      onClick={() => assignAgent(agent)}
                      size="sm"
                      variant="secondary"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Assign
                    </Button>
                    <Button
                      disabled={isPending || !selectedWorkspaceId}
                      onClick={() => generateKey(agent)}
                      size="sm"
                    >
                      <KeyRound className="h-4 w-4" />
                      Generate key
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {agent.workspace_assignments.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        No workspace assignments.
                      </span>
                    ) : null}
                    {agent.workspace_assignments.map((assignment) => (
                      <span
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs"
                        key={assignment.public_id}
                      >
                        <Check className="h-3.5 w-3.5 text-primary" />
                        {assignmentLabel(assignment)}
                        <button
                          className="rounded-sm text-muted-foreground hover:text-foreground"
                          disabled={isPending}
                          onClick={() => unassignAgent(agent, assignment)}
                          type="button"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
