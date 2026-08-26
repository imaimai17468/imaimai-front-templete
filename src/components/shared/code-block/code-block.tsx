interface CodeBlockProps {
  label: string;
  code: string;
}

// The scroll container is focusable so keyboard users can pan the overflowing
// line (axe scrollable-region-focusable, WCAG 2.1.1), and it is a `section`
// with an aria-label so the block has a real accessible name: `pre`'s implicit
// role is `generic`, which prohibits naming from aria-label, and
// `role="region"` on it would trip prefer-tag-over-role.
export const CodeBlock = ({ label, code }: CodeBlockProps) => (
  <section
    className="overflow-x-auto rounded-lg bg-muted px-4 py-3"
    tabIndex={0}
    aria-label={label}
  >
    <pre className="font-mono text-sm leading-relaxed text-foreground">
      <code>{code}</code>
    </pre>
  </section>
);
