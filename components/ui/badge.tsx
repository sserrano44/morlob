import { clsx } from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "default" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-emerald-100 text-emerald-800",
        tone === "warning" && "bg-amber-100 text-amber-900",
        tone === "danger" && "bg-red-100 text-red-800"
      )}
    >
      {children}
    </span>
  );
}
