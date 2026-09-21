import { CodeBlock } from "./code-block/code-block";
import { LINKS, SETUP, SPECS, TREE } from "./home-content";
import { Section } from "./section";

export const HomePage = () => (
  <div className="flex flex-col gap-12 pb-16">
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-medium tracking-tight">
        imaimai-front-templete
      </h1>
      <p className="max-w-prose text-muted-foreground">
        TanStack Start を Cloudflare Workers
        で動かすフルスタックテンプレート。認証とデータベースとストレージは配線済みで、規約は文書だけでなく
        lint プラグインと git hook にも置いてある。
      </p>
      <a
        href="https://github.com/imaimai17468/imaimai-front-templete"
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:opacity-70"
      >
        GitHub
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>

    <Section heading="セットアップ">
      <CodeBlock label="セットアップコマンド" code={SETUP} />
      <p className="max-w-prose text-sm text-muted-foreground">
        http://my-app.localhost:1355 でアクセスできる（portless が名前付き URL
        を割り当てる）。
        <code className="font-mono text-foreground">
          src/routes/index/-components/home-page.tsx
        </code>{" "}
        を編集して開発を始められます。
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        mise を使わない場合は、
        <code className="font-mono text-foreground">package.json</code> の
        engines.node を満たす Node と{" "}
        <code className="font-mono text-foreground">mise.toml</code>{" "}
        が指定する版の Bun を手動で用意する。rc を読まないシェルからは{" "}
        <code className="font-mono text-foreground">mise exec --</code>{" "}
        を通す。Cursor Cloud Agent では{" "}
        <code className="font-mono text-foreground">
          .cursor/environment.json
        </code>{" "}
        が同じセットアップを自動実行する。
      </p>
    </Section>

    <Section heading="ファイル構成">
      <CodeBlock label="src ディレクトリの構成" code={TREE} />
      <p className="max-w-prose text-sm text-muted-foreground">
        配置と import 方向の規約は{" "}
        <code className="font-mono text-foreground">AGENTS.md</code> の Rules
        にある。
      </p>
    </Section>

    {SPECS.map((spec) => (
      <Section key={spec.heading} heading={spec.heading}>
        <dl className="flex flex-col gap-3">
          {spec.rows.map((row) => (
            <div
              key={row.term}
              className="flex flex-col gap-1 sm:flex-row sm:gap-6"
            >
              <dt className="text-sm font-medium text-foreground sm:w-36 sm:shrink-0">
                {row.term}
              </dt>
              <dd className="max-w-prose text-sm text-muted-foreground">
                {row.detail}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    ))}

    <Section heading="参考リンク">
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:opacity-70"
            >
              {link.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>

    <p className="max-w-prose text-sm text-muted-foreground">
      データベースと認証の設定は{" "}
      <code className="font-mono text-foreground">docs/DATABASE_SETUP.md</code>
      、デプロイとロールバックは{" "}
      <code className="font-mono text-foreground">docs/DEPLOYMENT.md</code>
      、新規プロジェクトへの流用は{" "}
      <code className="font-mono text-foreground">docs/FORKING.md</code>
      、サーバ境界を動かす前提は{" "}
      <code className="font-mono text-foreground">docs/SERVER_BOUNDARY.md</code>
      。
    </p>
  </div>
);
