import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  asChild = false,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "lg" && "h-11 px-5",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" &&
          "border-border bg-surface text-foreground hover:bg-muted",
        variant === "ghost" &&
          "border-transparent bg-transparent text-foreground hover:bg-muted",
        variant === "danger" &&
          "border-danger bg-danger text-white hover:bg-danger/90",
        className
      )}
      {...props}
    />
  );
}
