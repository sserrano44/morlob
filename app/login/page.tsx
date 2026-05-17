import { LoginForm } from "@/components/app-shell/login-form";
import { safeInternalPath } from "@/lib/oauth/security";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-normal">Sign in to Morlob</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Create an account or sign in with Supabase Auth. Signup is open for
            this build.
          </p>
        </div>
        <LoginForm nextPath={safeInternalPath(nextParam)} />
      </div>
    </main>
  );
}
