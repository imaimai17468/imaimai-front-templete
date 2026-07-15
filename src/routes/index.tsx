import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const PALETTE = [
  { name: "漆黒", cssVar: "var(--palette-shikkoku)" },
  { name: "鈍色", cssVar: "var(--palette-nibiiro)" },
  { name: "銀鼠", cssVar: "var(--palette-ginnezumi)" },
  { name: "白鼠", cssVar: "var(--palette-shironezumi)" },
  { name: "卯の花", cssVar: "var(--palette-unohana)" },
] as const;

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
          TanStack Start + Cloudflare Workers
          のフルスタックテンプレート。和色パレットと squircle
          コーナーを標準装備。
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
        <pre
          className="overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-sm leading-relaxed text-foreground"
          tabIndex={0}
          role="region"
          aria-label="Getting started commands"
        >
          <code>{`git clone https://github.com/imaimai17468/imaimai-front-templete.git
cd imaimai-front-templete
bun install
cp .env.local.example .env.local
bun run dev`}</code>
        </pre>
        <p className="text-sm text-muted-foreground">
          <code className="rounded-lg bg-muted px-1.5 py-0.5 font-mono text-foreground">
            src/routes/index.tsx
          </code>{" "}
          を編集して開発を始められます。
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Stack</h2>
          <p className="max-w-prose text-sm text-foreground">
            {STACK.map((s) => s.name).join(" · ")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Palette</h2>
          <div className="flex flex-wrap items-center gap-3 gap-y-2">
            {PALETTE.map((color) => (
              <div key={color.name} className="flex items-center gap-1.5">
                <div
                  className="size-5 rounded-md ring-1 ring-palette-ring"
                  style={{ background: color.cssVar }}
                />
                <span className="text-xs text-muted-foreground">
                  {color.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
