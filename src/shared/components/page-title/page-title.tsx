import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const PageTitle = ({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"h1">) => (
  <h1
    className={cn("text-2xl font-semibold tracking-tight", className)}
    {...props}
  >
    {children}
  </h1>
);
