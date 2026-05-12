"use client";

import {
  Archive,
  CheckCircle2,
  Copy,
  FileUp,
  KeyRound,
  ListTodo,
  Loader2,
  Plus,
  ShieldCheck,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

type Agent = {
  id: string;
  public_id: string;
  name: string;
  kind: string;
  status: string;
};

type Todo = {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  external_id: string | null;
  labels: string[];
  created_at: string;
};

type FileRecord = {
  id: string;
  public_id: string;
  filename: string;
  kind: string;
  content_type: string;
  size_bytes: number;
  visibility: "private" | "public";
  created_at: string;
};

export type DashboardData = {
  organizations: Organization[];
  workspaces: Workspace[];
  agents: Agent[];
  todos: Todo[];
  files: FileRecord[];
};

type Props = {
  data: DashboardData;
  email: string;
  setupError: string | null;
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

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function DashboardClient({ data, email, setupError }: Props) {
  const [organizations, setOrganizations] = useState(data.organizations);
  const [workspaces, setWorkspaces] = useState(data.workspaces);
  const [agents, setAgents] = useState(data.agents);
  const [todos, setTodos] = useState(data.todos);
  const [files, setFiles] = useState(data.files);
  const [selectedOrgId, setSelectedOrgId] = useState(
    data.organizations[0]?.public_id ?? ""
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    data.workspaces[0]?.public_id ?? ""
  );
  const [selectedAgentId, setSelectedAgentId] = useState(
    data.agents[0]?.public_id ?? ""
  );
  const [orgName, setOrgName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDescription, setTodoDescription] = useState("");
  const [scopes, setScopes] = useState(defaultScopes);
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(setupError);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedOrg = useMemo(
    () => organizations.find((org) => org.public_id === selectedOrgId),
    [organizations, selectedOrgId]
  );
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.public_id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces]
  );

  useEffect(() => {
    if (!selectedOrgId) {
      return;
    }

    startTransition(async () => {
      try {
        const [workspacePayload, agentPayload] = await Promise.all([
          readJson<{ workspaces: Workspace[] }>(
            await fetch(`/api/v1/orgs/${selectedOrgId}/workspaces`)
          ),
          readJson<{ agents: Agent[] }>(
            await fetch(`/api/v1/orgs/${selectedOrgId}/agents`)
          )
        ]);

        setWorkspaces(workspacePayload.workspaces);
        setAgents(agentPayload.agents);
        setSelectedWorkspaceId(workspacePayload.workspaces[0]?.public_id ?? "");
        setSelectedAgentId(agentPayload.agents[0]?.public_id ?? "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load org.");
      }
    });
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    startTransition(async () => {
      try {
        const [todoPayload, filePayload] = await Promise.all([
          readJson<{ todos: Todo[] }>(
            await fetch(
              `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/todos`
            )
          ),
          readJson<{ files: FileRecord[] }>(
            await fetch(
              `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/files`
            )
          )
        ]);

        setTodos(todoPayload.todos);
        setFiles(filePayload.files);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load workspace.");
      }
    });
  }, [selectedOrgId, selectedWorkspaceId]);

  function run(action: () => Promise<void>) {
    setMessage(null);
    setDownloadUrl(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Request failed.");
      }
    });
  }

  function createOrganization() {
    run(async () => {
      const payload = await readJson<{ organization: Organization }>(
        await fetch("/api/v1/orgs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: orgName })
        })
      );
      setOrganizations((current) => [...current, { ...payload.organization, role: "owner" }]);
      setSelectedOrgId(payload.organization.public_id);
      setOrgName("");
    });
  }

  function createWorkspace() {
    if (!selectedOrgId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ workspace: Workspace }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/workspaces`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: workspaceName })
        })
      );
      setWorkspaces((current) => [...current, payload.workspace]);
      setSelectedWorkspaceId(payload.workspace.public_id);
      setWorkspaceName("");
    });
  }

  function createAgent() {
    if (!selectedOrgId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ agent: Agent }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: agentName, kind: "generic" })
        })
      );
      setAgents((current) => [...current, payload.agent]);
      setSelectedAgentId(payload.agent.public_id);
      setAgentName("");
    });
  }

  function assignAgent() {
    if (!selectedOrgId || !selectedAgentId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      await readJson(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/agents/${selectedAgentId}/workspace-assignments`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspace_id: selectedWorkspaceId })
          }
        )
      );
      setMessage("Agent assigned to workspace.");
    });
  }

  function generateKey() {
    if (!selectedOrgId || !selectedAgentId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ secret: string }>(
        await fetch(`/api/v1/orgs/${selectedOrgId}/agents/${selectedAgentId}/keys`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Default workspace key",
            scopes: scopes
              .split(",")
              .map((scope) => scope.trim())
              .filter(Boolean)
          })
        })
      );
      setSecret(payload.secret);
    });
  }

  function createTodo() {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ todo: Todo }>(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/todos`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: todoTitle,
              description: todoDescription || null,
              source: "manual"
            })
          }
        )
      );
      setTodos((current) => [payload.todo, ...current]);
      setTodoTitle("");
      setTodoDescription("");
    });
  }

  function completeTodo(todo: Todo) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ todo: Todo }>(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/todos/${todo.public_id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "completed" })
          }
        )
      );
      setTodos((current) =>
        current.map((item) =>
          item.public_id === todo.public_id ? payload.todo : item
        )
      );
    });
  }

  function uploadFile(formData: FormData) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ file: FileRecord }>(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/files`,
          {
            method: "POST",
            body: formData
          }
        )
      );
      setFiles((current) => [payload.file, ...current]);
    });
  }

  function toggleFileVisibility(file: FileRecord) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ file: FileRecord }>(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/files/${file.public_id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              visibility: file.visibility === "public" ? "private" : "public"
            })
          }
        )
      );
      setFiles((current) =>
        current.map((item) =>
          item.public_id === file.public_id ? payload.file : item
        )
      );
    });
  }

  function createDownloadUrl(file: FileRecord) {
    if (!selectedOrgId || !selectedWorkspaceId) {
      return;
    }

    run(async () => {
      const payload = await readJson<{ url: string }>(
        await fetch(
          `/api/v1/orgs/${selectedOrgId}/workspaces/${selectedWorkspaceId}/files/${file.public_id}/download-url`,
          { method: "POST" }
        )
      );
      setDownloadUrl(payload.url);
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-5 py-5">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Morlob</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {email}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              onChange={(event) => setSelectedOrgId(event.target.value)}
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
              onChange={(event) => {
                setSelectedWorkspaceId(event.target.value);
                if (!event.target.value) {
                  setTodos([]);
                  setFiles([]);
                }
              }}
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

        {downloadUrl ? (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="font-medium">Signed URL</div>
            <a
              className="mt-1 block break-all underline"
              href={downloadUrl}
              rel="noreferrer"
              target="_blank"
            >
              {downloadUrl}
            </a>
          </div>
        ) : null}

        {secret ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Agent key secret</div>
                <div className="mt-1 font-mono text-xs">{secret}</div>
              </div>
              <Button
                onClick={() => navigator.clipboard.writeText(secret)}
                type="button"
                variant="secondary"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4 text-primary" />
                Organization
              </h2>
              <div className="mt-4 flex gap-2">
                <Input
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="Acme Research"
                  value={orgName}
                />
                <Button disabled={isPending || !orgName} onClick={createOrganization}>
                  Create
                </Button>
              </div>
              {selectedOrg ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Current: {selectedOrg.public_id}
                </p>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Archive className="h-4 w-4 text-primary" />
                Workspace
              </h2>
              <div className="mt-4 flex gap-2">
                <Input
                  disabled={!selectedOrgId}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Default workspace"
                  value={workspaceName}
                />
                <Button
                  disabled={isPending || !workspaceName || !selectedOrgId}
                  onClick={createWorkspace}
                >
                  Create
                </Button>
              </div>
              {selectedWorkspace ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Current: {selectedWorkspace.public_id}
                </p>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" />
                Agents and keys
              </h2>
              <div className="mt-4 flex gap-2">
                <Input
                  disabled={!selectedOrgId}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="Codex local"
                  value={agentName}
                />
                <Button
                  disabled={isPending || !agentName || !selectedOrgId}
                  onClick={createAgent}
                >
                  Create
                </Button>
              </div>
              <select
                className="mt-3 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                onChange={(event) => setSelectedAgentId(event.target.value)}
                value={selectedAgentId}
              >
                <option value="">No agent</option>
                {agents.map((agent) => (
                  <option key={agent.public_id} value={agent.public_id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <Input
                className="mt-3"
                onChange={(event) => setScopes(event.target.value)}
                value={scopes}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={
                    isPending ||
                    !selectedOrgId ||
                    !selectedAgentId ||
                    !selectedWorkspaceId
                  }
                  onClick={assignAgent}
                  variant="secondary"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Assign
                </Button>
                <Button
                  disabled={isPending || !selectedOrgId || !selectedAgentId}
                  onClick={generateKey}
                >
                  Generate key
                </Button>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ListTodo className="h-4 w-4 text-primary" />
                  Todos
                </h2>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  disabled={!selectedWorkspaceId}
                  onChange={(event) => setTodoTitle(event.target.value)}
                  placeholder="Review generated patch"
                  value={todoTitle}
                />
                <Input
                  disabled={!selectedWorkspaceId}
                  onChange={(event) => setTodoDescription(event.target.value)}
                  placeholder="Description"
                  value={todoDescription}
                />
                <Button
                  disabled={isPending || !todoTitle || !selectedWorkspaceId}
                  onClick={createTodo}
                >
                  Add
                </Button>
              </div>
              <div className="mt-4 divide-y divide-border">
                {todos.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">No todos yet.</p>
                ) : null}
                {todos.map((todo) => (
                  <div
                    className="flex items-start justify-between gap-4 py-3"
                    key={todo.public_id}
                  >
                    <div>
                      <div className="font-medium">{todo.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge tone={todo.status === "completed" ? "success" : "default"}>
                          {todo.status}
                        </Badge>
                        <span>{todo.priority}</span>
                        <span>{todo.public_id}</span>
                      </div>
                    </div>
                    <Button
                      disabled={todo.status === "completed"}
                      onClick={() => completeTodo(todo)}
                      size="sm"
                      variant="secondary"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FileUp className="h-4 w-4 text-primary" />
                  Files
                </h2>
                <span className="text-xs text-muted-foreground">5 MB max</span>
              </div>
              <form
                className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  uploadFile(formData);
                  event.currentTarget.reset();
                }}
              >
                <Input disabled={!selectedWorkspaceId} name="file" required type="file" />
                <select
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                  name="visibility"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <Button disabled={isPending || !selectedWorkspaceId} type="submit">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </form>
              <div className="mt-4 divide-y divide-border">
                {files.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">No files yet.</p>
                ) : null}
                {files.map((file) => (
                  <div
                    className="flex items-start justify-between gap-4 py-3"
                    key={file.public_id}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{file.filename}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge tone={file.visibility === "public" ? "success" : "default"}>
                          {file.visibility}
                        </Badge>
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span>{file.public_id}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => toggleFileVisibility(file)}
                        size="sm"
                        variant="secondary"
                      >
                        {file.visibility === "public" ? "Private" : "Public"}
                      </Button>
                      <Button
                        onClick={() => createDownloadUrl(file)}
                        size="sm"
                        variant="secondary"
                      >
                        URL
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
