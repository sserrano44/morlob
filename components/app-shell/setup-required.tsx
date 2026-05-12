import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SetupRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-xl p-6">
        <h1 className="text-2xl font-semibold tracking-normal">Supabase setup required</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`
          to `.env.local`, then restart the dev server. The project URL is
          already set to `https://uwsqokoloqyfckixfmhb.supabase.co`. Legacy
          anon and service-role keys are still accepted as fallbacks.
        </p>
        <div className="mt-5">
          <Button asChild variant="secondary">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
