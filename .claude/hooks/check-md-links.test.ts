/**
 * Exercise check-md-links.ts against the shapes it has to judge.
 *
 * A link checker that reports "clean" is indistinguishable from one that finds
 * nothing at all, so every case it must catch and every case it must not report
 * is pinned here. The false-positive half matters as much as the other: this
 * repository quotes example link syntax inside code spans and fences, and a
 * checker that flagged those would be switched off within a day.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  cleanTarget,
  linkTargets,
  main,
  resolveTarget,
  stripCode,
  targetExists,
} from "./check-md-links";

const REPO = path.resolve(import.meta.dirname, "../..");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "md-links-check-"));

fs.mkdirSync(path.join(WORK, "sub"));
fs.writeFileSync(path.join(WORK, "real.md"), "# real\n");
fs.writeFileSync(path.join(WORK, "sub/nested.md"), "# nested\n");
fs.writeFileSync(path.join(WORK, "has(parens).md"), "# parens\n");
fs.writeFileSync(path.join(WORK, "with space.md"), "# space\n");

/** Reads one directory into the cache the way main() will key it. */
const primeListingCache = (doc: string, target: string): void => {
  const resolved = resolveTarget(doc, target);
  if (resolved !== null) {
    targetExists(resolved);
  }
};

describe("check-md-links", () => {
  afterAll(() => {
    fs.rmSync(WORK, { force: true, recursive: true });
  });

  const DOC = path.join(WORK, "doc.md");

  interface Reported {
    line: number;
    target: string;
  }

  /**
   * What the checker reports for one document, mirroring what main() counts.
   *
   * `targetExists` rather than a bare existence test, and `resolveTarget`'s null
   * treated as dead: a harness that does not walk the real code path is testing a
   * program that does not ship. An earlier version used a plain existence check and
   * therefore could not see the case-sensitivity defect at all.
   */
  const report = (body: string): Reported[] => {
    fs.writeFileSync(DOC, body);
    return linkTargets(stripCode(body)).flatMap(({ line, raw }) => {
      const cleaned = cleanTarget(raw);
      if (cleaned === null) {
        return [];
      }
      const target = resolveTarget(DOC, cleaned);
      return target !== null && targetExists(target)
        ? []
        : [{ line, target: cleaned }];
    });
  };

  const deadTargets = (body: string): string[] =>
    report(body).map(({ target }) => target);

  const firstReportedLine = (body: string): number | undefined =>
    report(body)[0]?.line;

  const resolvesToLiveFile = (target: string): boolean => {
    const resolved = resolveTarget(DOC, target);
    return resolved !== null && targetExists(resolved);
  };

  interface Case {
    label: string;
    body: string;
    dead: string[];
  }

  describe("a dead relative link is reported", () => {
    it.each<Case>([
      {
        body: "see [x](./gone.md)\n",
        dead: ["./gone.md"],
        label: "missing sibling",
      },
      {
        body: "see [x](sub/gone.md)\n",
        dead: ["sub/gone.md"],
        label: "missing nested",
      },
      {
        body: "see [x](../gone.md)\n",
        dead: ["../gone.md"],
        label: "missing parent-relative",
      },
      {
        body: "![alt](./gone.png)\n",
        dead: ["./gone.png"],
        label: "image target",
      },
      {
        body: "[ref]: ./gone.md\n",
        dead: ["./gone.md"],
        label: "reference definition",
      },
      // A caret is only footnote syntax when it LEADS the label. Excluding it
      // anywhere made `[a^b]: ./gone.md` invisible, silently skipping a dead link.
      {
        body: "[a^b]: ./gone.md\n",
        dead: ["./gone.md"],
        label: "reference label with a non-leading caret",
      },
      {
        body: "[^note]: ./gone.md\n",
        dead: [],
        label: "footnote definition is still skipped",
      },
      {
        body: "[a](./g1.md) [b](./g2.md)\n",
        dead: ["./g1.md", "./g2.md"],
        label: "two on one line",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("a live relative link is not reported", () => {
    it.each<Case>([
      { body: "see [x](./real.md)\n", dead: [], label: "sibling" },
      { body: "see [x](real.md)\n", dead: [], label: "sibling without ./" },
      { body: "see [x](sub/nested.md)\n", dead: [], label: "nested" },
      { body: "see [x](./sub)\n", dead: [], label: "directory target" },
      {
        body: "[ref]: ./real.md\n",
        dead: [],
        label: "live reference definition",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("targets that are not paths in this repository are skipped", () => {
    it.each<Case>([
      { body: "[x](https://example.com/gone.md)\n", dead: [], label: "https" },
      { body: "[x](http://example.com/gone.md)\n", dead: [], label: "http" },
      { body: "[x](mailto:nobody@example.com)\n", dead: [], label: "mailto" },
      {
        body: "[x](//example.com/gone.md)\n",
        dead: [],
        label: "protocol-relative",
      },
      { body: "[x](#some-heading)\n", dead: [], label: "same-document anchor" },
      { body: "[x]()\n", dead: [], label: "empty target" },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("fragments and queries address a real file", () => {
    it.each<Case>([
      {
        body: "[x](./real.md#heading)\n",
        dead: [],
        label: "live file with anchor",
      },
      {
        body: "[x](./gone.md#heading)\n",
        dead: ["./gone.md"],
        label: "dead file with anchor reports the file",
      },
      {
        body: "[x](./real.md?plain=1)\n",
        dead: [],
        label: "live file with query",
      },
      {
        body: "[x](#real.md)\n",
        dead: [],
        label: "anchor only is not a dead file",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("quoted example syntax is not a link — the false-positive half", () => {
    it.each<Case>([
      {
        body: "the form `](0015-flat.md)` is retired\n",
        dead: [],
        label: "inline code span",
      },
      {
        body: "``a ` and ](./gone.md)`` here\n",
        dead: [],
        label: "double backtick span",
      },
      {
        body: "text\n```\nsee [x](./gone.md)\n```\nmore\n",
        dead: [],
        label: "fenced block",
      },
      {
        body: "text\n```markdown\n[x](./gone.md)\n```\n",
        dead: [],
        label: "fenced block with info string",
      },
      {
        body: "text\n~~~\n[x](./gone.md)\n~~~\n",
        dead: [],
        label: "tilde fence",
      },
      {
        body: "text\n  ```\n  [x](./gone.md)\n  ```\n",
        dead: [],
        label: "indented fence",
      },
      {
        body: "````\n```\n[x](./gone.md)\n```\n````\n",
        dead: [],
        label: "longer fence is not closed by a shorter run",
      },
      {
        body: "```\n[a](./inside.md)\n```\n[b](./gone.md)\n",
        dead: ["./gone.md"],
        label: "a link after a closed fence is still checked",
      },
      {
        body: "a ` stray tick then [x](./gone.md)\n",
        dead: ["./gone.md"],
        label: "an unterminated backtick run does not swallow the rest",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  // The implementation of indented code blocks looked right, passed its own tests,
  // and still made the first case below invisible — a false negative, which in a
  // gate is silent. The false positive it was fixing lived in the checker's own
  // docstring, which is fenced now. See stripCode's docstring.
  describe("indented code is deliberately NOT treated as code", () => {
    it.each<Case>([
      {
        body: "- item\n\n    ```\n    code\n    ```\n\n    [x](./gone.md)\n",
        dead: ["./gone.md"],
        label: "a link after a fenced block inside a list stays visible",
      },
      {
        body: "- top\n    - [x](./gone.md)\n",
        dead: ["./gone.md"],
        label: "a nested list item stays visible",
      },
      {
        body: "Usage:\n\n    See [x](./gone.md)\n",
        dead: ["./gone.md"],
        label: "an indented example IS reported — the accepted cost",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("a UTF-8 BOM must not defeat fence detection", () => {
    it.each<Case>([
      {
        body: "﻿```\n[x](./gone.md)\n```\n",
        dead: [],
        label: "BOM then a first-line fence",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("shapes that were invisible", () => {
    it.each<Case>([
      {
        body: 'See <a href="./gone.md">here</a>.\n',
        dead: ["./gone.md"],
        label: "raw HTML anchor",
      },
      {
        body: "<a href='./gone.md'>x</a>\n",
        dead: ["./gone.md"],
        label: "HTML anchor, single quotes",
      },
      {
        body: "<a href=./gone.md>x</a>\n",
        dead: ["./gone.md"],
        label: "HTML anchor, unquoted",
      },
      {
        body: '<a href="./real.md">x</a>\n',
        dead: [],
        label: "HTML anchor to a live file",
      },
      {
        body: "> [ref]: ./gone.md\n",
        dead: ["./gone.md"],
        label: "reference definition in a blockquote",
      },
      {
        body: ">> [ref]: ./gone.md\n",
        dead: ["./gone.md"],
        label: "nested blockquote definition",
      },
      // An escaped paren used to make the balanced scan never reach depth 0, so the
      // link was dropped entirely — the checker could not tell dead from alive
      // because it never looked, which is worse than reporting the wrong answer.
      {
        body: "[x](./no\\(such.md)\n",
        dead: ["./no\\(such.md"],
        label: "escaped paren in the destination",
      },
      // The escape must not swallow a newline. Two shapes, because the first alone
      // certified the bug as fixed for a while: its expected answer is recovered by
      // a SECOND `](` match inside the text the broken scan swallowed. Only the
      // isolated shape — no second link to rescue it — fails when the escape skips
      // past the newline.
      {
        body: "[x](abc\\\n[y](./gone.md)\n",
        dead: ["./gone.md"],
        label: "a backslash at line end does not join the next line",
      },
      {
        body: "[x](abc\\\ndef)\n",
        dead: [],
        label: "backslash-escaped newline does not merge lines (isolated)",
      },
      // A word boundary is satisfied by a hyphen or colon, so these read as the real
      // attribute. A `data-href` usually drives JavaScript and points at nothing on
      // disk.
      {
        body: '<a data-href="./gone.md">x</a>\n',
        dead: [],
        label: "data-href is not an href",
      },
      {
        body: '<a aria-href="./gone.md">x</a>\n',
        dead: [],
        label: "aria-href is not an href",
      },
      {
        body: '<a xlink:href="./gone.md">x</a>\n',
        dead: [],
        label: "xlink:href is not an href",
      },
      {
        body: '```\n<a href="./gone.md">x</a>\n```\n',
        dead: [],
        label: "href in a fenced block stays quoted",
      },
      {
        body: '<a href="https://x.test/a.md">x</a>\n',
        dead: [],
        label: "an anchor to an external URL is skipped",
      },
      {
        body: '<a href="#top">x</a>\n',
        dead: [],
        label: "an anchor to a fragment is skipped",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("target syntax that a naive regex gets wrong", () => {
    it.each<Case>([
      {
        body: '[x](./real.md "the title")\n',
        dead: [],
        label: "title after target",
      },
      {
        body: '[x](./gone.md "the title")\n',
        dead: ["./gone.md"],
        label: "dead target with title reports only the path",
      },
      // An unbracketed destination cannot contain a space, so the parens case is
      // only well-formed without one. A regex stopping at the first `)` would
      // truncate this to `./has(parens` and call an existing file dead.
      { body: "[x](./has(parens).md)\n", dead: [], label: "balanced parens" },
      {
        body: "[x](./no(such).md)\n",
        dead: ["./no(such).md"],
        label: "dead balanced parens",
      },
      {
        body: "[x](<./with space.md>)\n",
        dead: [],
        label: "angle brackets with space",
      },
      {
        body: "[x](./with%20space.md)\n",
        dead: [],
        label: "percent-encoded space",
      },
      {
        body: "[x](./gone.md\n)\n",
        dead: [],
        label: "newline before close paren is not a link",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe("root-relative targets resolve against the repository root", () => {
    it.each<Case>([
      { body: "[x](/README.md)\n", dead: [], label: "live root-relative" },
      {
        body: "[x](/nope-does-not-exist.md)\n",
        dead: ["/nope-does-not-exist.md"],
        label: "dead root-relative",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  // Uses a real sibling of the repository rather than creating one, because a test
  // has no business writing outside the repository it checks.
  const sibling = fs
    .readdirSync(path.dirname(REPO))
    .toSorted()
    .find((entry) => entry !== path.basename(REPO) && !entry.startsWith("."));
  const escapeOntoSibling = `/../${sibling ?? ""}`;

  describe("a root-relative target may not climb above the repository root", () => {
    // Without the clamp the escaped path was returned, and a same-named file in the
    // parent directory (a nested checkout, a sibling package) reported the link
    // LIVE — a false negative, the failure mode this gate cannot afford because
    // nothing announces it.
    it("should resolve to null when the target climbs above the root", () => {
      expect(resolveTarget(DOC, "/../anything.md")).toBeNull();
    });

    // The case that actually bites: the escaped path EXISTS.
    it.runIf(sibling !== undefined)(
      "should report dead when the escape lands on a real sibling of the repository",
      () => {
        expect(deadTargets(`[x](${escapeOntoSibling})\n`)).toStrictEqual([
          escapeOntoSibling,
        ]);
      }
    );
  });

  // On a case-insensitive filesystem (APFS by default) a bare existence test answers
  // true for the wrong case, so a wrong-case link passed the local Stop gate and
  // failed in CI — splitting the local gate from the step meant to be redundant with
  // it. Each path component is checked against real directory entries instead.
  describe("a wrong-case target is dead even where the filesystem disagrees", () => {
    it.each<Case>([
      { body: "[x](./real.md)\n", dead: [], label: "exact case" },
      {
        body: "[x](./REAL.MD)\n",
        dead: ["./REAL.MD"],
        label: "wrong case on the file",
      },
      {
        body: "[x](./SUB/nested.md)\n",
        dead: ["./SUB/nested.md"],
        label: "wrong case in a directory",
      },
      {
        body: "[x](./sub/NESTED.md)\n",
        dead: ["./sub/NESTED.md"],
        label: "wrong case, live file, live dir",
      },
    ])("$label", ({ body, dead }) => {
      expect(deadTargets(body)).toStrictEqual(dead);
    });
  });

  describe(targetExists, () => {
    it("should return true when the case matches the disk", () => {
      expect(targetExists(path.join(WORK, "real.md"))).toBeTruthy();
    });

    it("should return false when only the case differs", () => {
      expect(targetExists(path.join(WORK, "REAL.MD"))).toBeFalsy();
    });
  });

  // The root-relative branch was not normalised, so a literal `..` survived into the
  // component walk, where no real directory ever lists `..`.
  describe("a root-relative target with .. still resolves", () => {
    it.each([
      { label: "plain root-relative", target: "/AGENTS.md" },
      { label: "root-relative through ..", target: "/docs/../AGENTS.md" },
    ])("$label resolves to a live file", ({ target }) => {
      expect(resolvesToLiveFile(target)).toBeTruthy();
    });
  });

  describe("the directory-listing cache does not outlive one scan", () => {
    // Cached per directory and never refreshed, a file created after its parent was
    // first listed read as dead for the rest of the process — and this file shares
    // one process with every other test here.
    //
    // Exercised through main(), which is where the clearing lives. Priming through
    // resolveTarget rather than a bare path keeps the cache key identical to the one
    // main() goes on to use, so the priming is not a no-op.
    it("should report a live link when the file was created after its directory was first listed", () => {
      const dir = path.join(WORK, "cache-check");
      fs.mkdirSync(dir);
      const doc = path.join(dir, "doc.md");
      fs.writeFileSync(path.join(dir, "seed.md"), "# seed\n");
      primeListingCache(doc, "./seed.md");
      fs.writeFileSync(path.join(dir, "created-later.md"), "# later\n");
      fs.writeFileSync(doc, "[x](./created-later.md)\n");
      expect(main([doc])).toBe(0);
    });
  });

  describe("a symlinked .md is skipped, not followed outside the repository", () => {
    it("should return 0 when the markdown file is a symlink", () => {
      const outside = path.join(WORK, "outside.md");
      fs.writeFileSync(outside, "[x](./nowhere-at-all.md)\n");
      const link = path.join(WORK, "linked.md");
      fs.symlinkSync(outside, link);
      expect(main([link])).toBe(0);
    });
  });

  describe("the report locates the link", () => {
    it("should report line 3 when the link sits on the third line", () => {
      expect(firstReportedLine("one\ntwo\n[x](./gone.md)\n")).toBe(3);
    });
  });

  describe("the exit code carries the verdict", () => {
    it("should exit non-zero when a link is dead", () => {
      const bad = path.join(WORK, "bad.md");
      fs.writeFileSync(bad, "[x](./gone.md)\n");
      expect(main([bad])).toBe(1);
    });

    it("should exit zero when every link is live", () => {
      expect(main([path.join(WORK, "real.md")])).toBe(0);
    });
  });
});
