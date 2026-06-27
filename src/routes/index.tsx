import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sun,
  Moon,
  Search,
  Settings,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const STACK_ITEMS = [
  {
    name: "TanStack Start",
    description: "Full-stack React framework with type-safe routing",
  },
  {
    name: "Cloudflare Workers",
    description: "Edge-first deployment on Cloudflare's global network",
  },
  {
    name: "shadcn/ui",
    description: "Accessible components built on Radix UI primitives",
  },
  {
    name: "Tailwind CSS v4",
    description: "Utility-first CSS with design token integration",
  },
  {
    name: "Better Auth",
    description: "Authentication with OAuth, email, and session management",
  },
  {
    name: "Drizzle ORM",
    description: "Type-safe SQL with Cloudflare D1 integration",
  },
] as const;

const DESIGN_TOKENS = [
  { label: "漆黒", cssVar: "var(--foreground)", role: "Foreground" },
  { label: "卯の花", cssVar: "var(--background)", role: "Background" },
  { label: "白鼠", cssVar: "var(--secondary)", role: "Secondary" },
  { label: "銀鼠", cssVar: "var(--border)", role: "Border" },
  { label: "鈍色", cssVar: "var(--muted-foreground)", role: "Muted" },
] as const;

const CHART_COLORS = [
  { name: "藍", cssVar: "var(--chart-1)" },
  { name: "若竹", cssVar: "var(--chart-2)" },
  { name: "山吹", cssVar: "var(--chart-3)" },
  { name: "紅", cssVar: "var(--chart-4)" },
  { name: "藤", cssVar: "var(--chart-5)" },
] as const;

function HomeComponent() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">
          imaimai-front-template
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          TanStack Start + Cloudflare Workers で構成された フルスタック React
          テンプレート。和色ベースのデザインシステムと squircle
          コーナーを標準装備。
        </p>
        <div className="flex gap-2 pt-2">
          <Button asChild>
            <a
              href="https://github.com/imaimai17468/imaimai-front-templete"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://tanstack.com/start/latest"
              target="_blank"
              rel="noopener noreferrer"
            >
              TanStack Start Docs
            </a>
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Get started</h2>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Edit{" "}
              <code className="rounded-lg bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                src/routes/index.tsx
              </code>{" "}
              to start building.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Tech Stack</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK_ITEMS.map((item) => (
            <Card key={item.name}>
              <CardHeader>
                <CardTitle className="text-base">{item.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Design System</h2>
        <p className="text-sm text-muted-foreground">
          和色 (Japanese traditional colors) with superellipse corners. Token
          values live in{" "}
          <code className="rounded-lg bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
            src/styles.css
          </code>
          , usage rules in{" "}
          <code className="rounded-lg bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
            .claude/rules/design.md
          </code>
          .
        </p>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Base Palette
            </h3>
            <div className="flex flex-wrap gap-4">
              {DESIGN_TOKENS.map((token) => (
                <div key={token.label} className="flex items-center gap-2">
                  <div
                    className="size-8 rounded-lg border border-border"
                    style={{ background: token.cssVar }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{token.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {token.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Chart Colors
            </h3>
            <div className="flex gap-2">
              {CHART_COLORS.map((color) => (
                <div
                  key={color.name}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className="size-8 rounded-lg"
                    style={{ background: color.cssVar }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {color.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Typography
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Body — Hiragino Kaku Gothic ProN
                </span>
                <p className="text-base">
                  あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら。
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Code — Menlo
                </span>
                <p className="font-mono text-base">
                  const greeting = &quot;こんにちは世界&quot;; 0123456789 ABCDEF
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Corner Shape
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-lg bg-foreground text-xs text-background">
                8px
              </div>
              <div className="flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-xs text-background">
                pill
              </div>
              <div className="flex size-16 items-center justify-center rounded-full bg-foreground text-xs text-background">
                full
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Icons — Lucide React
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Sun className="size-4 text-muted-foreground" />
                <Moon className="size-4 text-muted-foreground" />
                <Search className="size-4 text-muted-foreground" />
                <Settings className="size-4 text-muted-foreground" />
                <Plus className="size-4 text-muted-foreground" />
                <Trash2 className="size-4 text-destructive" />
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon">
                  <Sun />
                </Button>
                <Button variant="outline" size="icon">
                  <Search />
                </Button>
                <Button variant="outline" size="icon">
                  <Settings />
                </Button>
                <Button variant="outline" size="icon">
                  <Plus />
                </Button>
                <Button variant="destructive" size="icon">
                  <Trash2 />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button>
                  <Plus />
                  New
                </Button>
                <Button variant="secondary">
                  <Settings />
                  Settings
                </Button>
                <Button variant="outline">
                  <Search />
                  Search
                </Button>
                <Button variant="destructive">
                  <Trash2 />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Button Variants
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
