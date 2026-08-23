import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const STACK = [
  { name: "TanStack Start" },
  { name: "Cloudflare Workers" },
  { name: "shadcn/ui" },
  { name: "Tailwind CSS v4" },
  { name: "Better Auth" },
  { name: "Drizzle ORM" },
] as const;

function HomeComponent() {
  return (
    <div className="flex flex-col gap-12 pb-16">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">
          imaimai-front-template
        </h1>
        <p className="max-w-prose text-muted-foreground">
          TanStack Start + Cloudflare Workers のフルスタックテンプレート。
        </p>
        <a
          href="https://github.com/imaimai17468/imaimai-front-templete"
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70"
        >
          GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Get started
        </h2>
        {/* The scroll container is focusable so keyboard users can pan the
            overflowing command line (axe scrollable-region-focusable, WCAG
            2.1.1), and it is a `section` with an aria-label so the block has a
            real accessible name: `pre`'s implicit role is `generic`, which
            prohibits naming from aria-label, and `role="region"` on it would
            trip prefer-tag-over-role. */}
        <section
          className="overflow-x-auto rounded-lg bg-muted px-4 py-3"
          tabIndex={0}
          aria-label="Getting started commands"
        >
          <pre className="font-mono text-sm leading-relaxed text-foreground">
            <code>{`git clone https://github.com/imaimai17468/imaimai-front-templete.git
cd imaimai-front-templete
bun install
cp .env.local.example .env.local
bun run dev`}</code>
          </pre>
        </section>
        <p className="text-sm text-muted-foreground">
          <code className="rounded-lg bg-muted px-1.5 py-0.5 font-mono text-foreground">
            src/routes/index.tsx
          </code>{" "}
          を編集して開発を始められます。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Stack</h2>
        <p className="max-w-prose text-sm text-foreground">
          {STACK.map((s) => s.name).join(" · ")}
        </p>
      </section>
    </div>
  );
}
