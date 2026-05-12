import * as React from "react";
import { clsx } from "clsx";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      className={clsx(
        "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = "Input";
