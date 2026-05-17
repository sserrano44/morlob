"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabasePublishableKey } from "@/lib/config/public-env";
import { createSupabaseBrowserClient } from "@/lib/data/supabase/browser";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/app" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(mode: "signin" | "signup") {
    setMessage(null);
    startTransition(async () => {
      if (!supabasePublishableKey) {
        setMessage(
          "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local first."
        );
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await fetch("/api/auth/signup", {
              method: "POST",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({ email, password })
            }).then(async (response) => {
              const payload = await response.json();

              if (!response.ok) {
                return {
                  error: {
                    message: payload?.error?.message ?? "Signup failed."
                  }
                };
              }

              return supabase.auth.signInWithPassword({ email, password });
            });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      window.location.href = nextPath;
    });
  }

  return (
    <form
      className="rounded-lg border border-border bg-surface p-5 shadow-panel"
      onSubmit={(event) => {
        event.preventDefault();
        submit("signin");
      }}
    >
      <label className="block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <Input
        autoComplete="email"
        className="mt-2"
        id="email"
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        value={email}
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="password">
        Password
      </label>
      <Input
        autoComplete="current-password"
        className="mt-2"
        id="password"
        minLength={6}
        onChange={(event) => setPassword(event.target.value)}
        required
        type="password"
        value={password}
      />

      {message ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button disabled={isPending} type="submit">
          Sign in
        </Button>
        <Button
          disabled={isPending}
          onClick={() => submit("signup")}
          type="button"
          variant="secondary"
        >
          Create account
        </Button>
      </div>
    </form>
  );
}
