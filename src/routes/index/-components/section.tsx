import type { ReactNode } from "react";

export const Section = ({
  children,
  heading,
}: {
  readonly children: ReactNode;
  readonly heading: string;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-base font-medium">{heading}</h2>
    {children}
  </section>
);
