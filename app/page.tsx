import Link from "next/link";
import { ArrowRight, Blocks, Database, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: KeyRound,
    title: "Scoped agent keys",
    text: "Give external agents durable identities, explicit workspace assignments, and revocable scopes."
  },
  {
    icon: Blocks,
    title: "Workspace coordination",
    text: "Share todos and protected artifacts across Codex, local agents, scripts, and other workers."
  },
  {
    icon: Database,
    title: "Self-hostable core",
    text: "Supabase-backed state with private files, RLS policies, and configurable deployment mode."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-normal">Morlob</div>
          <Button asChild>
            <Link href="/app">Open app</Link>
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-normal text-foreground md:text-6xl">
              Backend control plane for the agents you already run.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Morlob gives teams shared durable state, explicit permissions,
              private files, and auditable APIs for external agents without
              becoming an agent runtime.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/api/v1/health">Health check</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 shadow-panel">
            <div className="rounded-md border border-border bg-[#0d1117] p-5 font-mono text-sm leading-7 text-slate-200">
              <div className="text-emerald-300">POST /api/v1/orgs/:org/workspaces/:workspace/todos</div>
              <div className="mt-4 text-slate-400">Authorization: Bearer mlb_...</div>
              <pre className="mt-4 whitespace-pre-wrap text-slate-100">{`{
  "title": "Review generated patch",
  "source": "codex",
  "external_id": "run_7821",
  "priority": "high"
}`}</pre>
            </div>
          </div>
        </div>

        <div className="grid gap-4 pb-8 md:grid-cols-3">
          {features.map((feature) => (
            <article
              className="rounded-lg border border-border bg-surface p-5"
              key={feature.title}
            >
              <feature.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
