import * as React from "react";
import { clsx } from "clsx";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-lg border border-border bg-surface shadow-sm", className)}
      {...props}
    />
  );
}
