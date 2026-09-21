import type { ReactNode } from "react";

export const ExternalLink = ({
  children,
  href,
}: {
  readonly children: ReactNode;
  readonly href: string;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:opacity-70"
  >
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);
