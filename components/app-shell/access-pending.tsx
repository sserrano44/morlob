import { Card } from "@/components/ui/card";

type Props = {
  status: "pending" | "rejected";
  email: string;
};

export function AccessPending({ email, status }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-xl p-6">
        <h1 className="text-2xl font-semibold tracking-normal">
          {status === "pending" ? "Approval pending" : "Access not approved"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {status === "pending"
            ? `${email} has been created and is waiting for a Morlob admin to approve access.`
            : `${email} is not approved for Morlob access.`}
        </p>
      </Card>
    </main>
  );
}
