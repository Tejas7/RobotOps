import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-primary text-white hover:opacity-95",
        variant === "secondary" && "border border-border bg-surface text-text hover:bg-white",
        variant === "tertiary" && "bg-transparent text-muted hover:text-text",
        variant === "danger" && "bg-danger text-white hover:opacity-95",
        className
      )}
      {...props}
    />
  );
}
