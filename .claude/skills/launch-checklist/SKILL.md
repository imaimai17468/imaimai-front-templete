---
name: launch-checklist
description: Pre-launch checklist for web services. Comprehensively audits security, SEO, OGP, performance, accessibility, and more, then generates a report.
when_to_use: When the user asks for a launch checklist, pre-launch audit, release readiness check, or wants to verify the app is ready for production.
argument-hint: "[category (optional): security, seo, ogp, performance, a11y, email, payment, env, all]"
arguments: category
---

# Pre-Launch Web Service Checklist

Comprehensively audit a pre-launch service and write a report to `docs/launch-checklist/YYYY-MM-DD.md`.

Reference: https://zenn.dev/catnose99/articles/547cbf57e5ad28

## Current git context

!`git log --oneline -1`

## Procedure

### 1. Determine audit scope

If `$category` is provided, audit only that category. Otherwise audit all categories.

Valid categories: `security`, `seo`, `ogp`, `performance`, `a11y`, `email`, `payment`, `env`, `all`

### 2. Run checklist audit

For each category in scope, inspect the codebase, configuration, and running application against the checklist below. Use grep, file reads, and chrome-devtools MCP tools as needed.

---

## Checklist

### Security — Cookie

| # | Item | How to verify |
|---|------|---------------|
| 1 | Auth cookies have the `HttpOnly` attribute set | Check the cookie options in auth config files / middleware |
| 2 | Auth cookies have `SameSite=Lax` or `Strict` set | Same as above. For `Lax`, confirm there is no endpoint that performs mutations on GET requests |
| 3 | Auth cookies have the `Secure` attribute set | Same as above |
| 4 | Auth cookies have an appropriate `Domain` attribute | Check the risk of cookie leakage to subdomains. Using the `__Host-` prefix is recommended |

### Security — Input Validation

| # | Item | How to verify |
|---|------|---------------|
| 5 | User input is validated on both the client and the server | Check form submission handling and server-side handlers |
| 6 | URL inputs have protocol restrictions (e.g. blocking `javascript:` URLs) | Grep form fields that accept URLs and check the validation logic |
| 7 | HTML output is escaped / sanitized | Grep usages of `dangerouslySetInnerHTML` and `innerHTML` and check for sanitization |
| 8 | SQL injection is prevented | Check usages of raw SQL queries. Confirm the ORM's parameter binding is used |
| 9 | Usernames are checked for path conflicts and reserved words | Check the username validation logic. Confirm a reserved-word list (`admin`, `contact`, etc.) exists |

### Security — Response Headers

| # | Item | How to verify |
|---|------|---------------|
| 10 | The `Strict-Transport-Security` header is set | Check response headers. Recommended: `max-age=31536000; includeSubDomains; preload` |
| 11 | `X-Frame-Options` or CSP `frame-ancestors` is set | Check response headers. Recommended: `DENY` or `SAMEORIGIN` |
| 12 | `X-Content-Type-Options: nosniff` is set | Check response headers |

### Security — Other

| # | Item | How to verify |
|---|------|---------------|
| 13 | Sensitive operations (account deletion, email change, etc.) require a recent re-authentication | Check the middleware / handlers for the relevant endpoints |
| 14 | Per-user responses are not cached in a CDN / KVS | Check cache settings and `Cache-Control` headers |
| 15 | Object storage directory listing is private | Check the public access settings of the R2 / S3 bucket |
| 16 | Open redirects are prevented | Check that user-supplied URLs are validated in redirect handling |
| 17 | Authorization checks are in place (prevent unauthenticated / unauthorized users from operating on data) | Check the authorization middleware on API endpoints |
| 18 | DELETE / UPDATE statements have an appropriate WHERE clause | Check the queries in the gateway / repository layer |
| 19 | User input is not injected into response headers | Check where headers are set |
| 20 | Server error details are not exposed to the client | Check error handling |
| 21 | File uploads validate format, size, and filename | Check the upload handling |
| 22 | Periodic DB backups are enabled | Check Cloudflare D1 / infrastructure settings |
| 23 | Two-factor authentication is enabled on cloud accounts | Manual check (note in the report) |
| 24 | A Content Security Policy (CSP) is configured | Check response headers |

### Security — Login

| # | Item | How to verify |
|---|------|---------------|
| 25 | Email address ownership is verified | Check the authentication flow |
| 26 | Email enumeration attacks are mitigated | Check the error messages on login and password reset |
| 27 | Behavior is defined when multiple login methods (OAuth + Email, etc.) share the same email address | Check the auth configuration |
| 28 | A flow exists to change the email address / linked accounts | Check the settings page |

### Email

| # | Item | How to verify |
|---|------|---------------|
| 29 | User input cannot be abused inside email bodies | Check the templates in the email sending logic |
| 30 | Sending large volumes of duplicate emails is prevented | Check the batch processing for notifications |
| 31 | SPF / DKIM / DMARC are configured | Check DNS settings (manual check) |
| 32 | Batch processing prevents duplicate sends (idempotency) | Check the email-sending job implementation |
| 33 | Newsletter unsubscribe is possible without logging in | Check the link inside the email |
| 34 | `List-Unsubscribe=One-Click` is supported | Check the email headers |

### SEO

| # | Item | How to verify |
|---|------|---------------|
| 35 | Every page has an appropriate `<title>` tag | Check the router config and each page's head settings |
| 36 | Canonical URLs are set | Check `<link rel="canonical">`. Normalize URLs with query parameters |
| 37 | Error pages return an appropriate status code (40x / 50x), or have `noindex` set | Check error handling and response codes |
| 38 | Search result pages have `noindex` or a canonical URL set | Check the meta tags on search pages |
| 39 | `noindex` is removed in production | Check the `robots` meta tag and `robots.txt` |
| 40 | Key pages (top page, etc.) have a meta description | Check the head settings |
| 41 | An XML sitemap is generated and registered | Check the `/sitemap.xml` route and its contents |

### OGP

| # | Item | How to verify |
|---|------|---------------|
| 42 | Shareable pages have `og:title` set | Check each page's head meta tags |
| 43 | `og:description` is set | Same as above |
| 44 | `og:url` is set | Same as above |
| 45 | `og:image` is set | Same as above. Also check the image's resolution and aspect ratio |
| 46 | `twitter:card` is set | Same as above. `summary_large_image` recommended |

### Payment (if applicable)

| # | Item | How to verify |
|---|------|---------------|
| 47 | The owner and flow for accounting are confirmed | Manual check |
| 48 | DB inconsistency on payment failure is handled | Check the error handling in payment processing |
| 49 | Duplicate payments are prevented | Check the idempotency key in payment processing |
| 50 | Data inconsistency on account deletion is prevented | Check the account deletion flow |
| 51 | Subscription auto-cancellation is handled | Check the deletion-time processing |
| 52 | Refund / proration terms are explained | Check the terms of service / deletion page |
| 53 | A cancellation flow is provided | Check the UI |
| 54 | Card expiration is handled | Check notifications / flow on renewal failure |
| 55 | Qualified invoice requirements are met | Check the invoice contents |

### Accessibility

| # | Item | How to verify |
|---|------|---------------|
| 56 | Images have appropriate `alt` attributes | Grep `<img>` tags and check the presence and content of `alt` |
| 57 | Icon-only buttons / links have an `aria-label` | Check SVG icon buttons. Pattern: `<a aria-label="..."><svg aria-hidden="true"></svg></a>` |
| 58 | Element roles are recognizable by screen readers | Run a Lighthouse a11y audit (use the `/lighthouse-audit` skill) |

### Performance

| # | Item | How to verify |
|---|------|---------------|
| 59 | Unnecessary modules are not included in the bundle | Check with a `bundle-analyzer` or similar |
| 60 | Static files are cached by the CDN | Check `Cache-Control` headers and CDN settings |
| 61 | Layout shift is prevented | Check that `<img>` has `aspect-ratio` or `width` / `height` set |
| 62 | Image sizes are optimized | Check there are no images far larger than their display size |
| 63 | The DB has appropriate indexes | Check the indexes in the schema definition |

### Multi-Environment

| # | Item | How to verify |
|---|------|---------------|
| 64 | The UI does not break at phone / tablet sizes | Check responsiveness with chrome-devtools |
| 65 | Verified in browsers other than Chrome (Safari, Firefox) | Manual check (note in the report) |
| 66 | No layout jitter from the scrollbar on Windows | Check the `scrollbar-gutter` setting |
| 67 | The UI does not break when user input is long | Check rendering with long usernames, etc. |

### Other

| # | Item | How to verify |
|---|------|---------------|
| 68 | No problem if local storage / cookies are cleared after 7 days under iOS Safari ITP | Check the auth persistence mechanism |
| 69 | No dependency on third-party cookies | Check cookie settings and external service integrations |
| 70 | `<html lang="...">` is set | Check the root HTML template |
| 71 | A server-error detection / alerting mechanism exists | Check the error monitoring configuration |
| 72 | 404 / 50x error pages have a link back to the top page | Check the error page components |
| 73 | A favicon is set | Check `<link rel="icon">` |
| 74 | An Apple touch icon is set | Check `<link rel="apple-touch-icon">` |
| 75 | Analytics is installed (if needed) | Check for the presence of an analytics script |

---

### 3. Write report

Create `docs/launch-checklist/YYYY-MM-DD.md`:

```markdown
# Launch Checklist Report — YYYY-MM-DD

Commit: `{short hash}` {commit message}

## Summary

| Category | Pass | Fail | N/A | Score |
|----------|------|------|-----|-------|
| Security — Cookie | x | x | x | x/x |
| Security — Input Validation | x | x | x | x/x |
| Security — Response Headers | x | x | x | x/x |
| Security — Other | x | x | x | x/x |
| Security — Login | x | x | x | x/x |
| Email | x | x | x | x/x |
| SEO | x | x | x | x/x |
| OGP | x | x | x | x/x |
| Payment | x | x | x | x/x |
| Accessibility | x | x | x | x/x |
| Performance | x | x | x | x/x |
| Multi-Environment | x | x | x | x/x |
| Other | x | x | x | x/x |
| **Total** | **x** | **x** | **x** | **x/75** |

## Details

### {Category}

| # | Item | Status | Notes |
|---|------|--------|-------|
| {n} | {item} | PASS / FAIL / N/A | {evidence or fix suggestion} |

(Repeat for each category in scope)

## Action Items

Priority fixes (FAIL items ordered by severity):

1. **[Critical]** {item} — {fix suggestion}
2. **[Important]** {item} — {fix suggestion}
3. **[Minor]** {item} — {fix suggestion}
```

### 4. Compare with previous

If a previous report exists in `docs/launch-checklist/`, compare results. Note newly passing or regressed items under `## Changes from previous audit`.

### 5. Fix issues (if requested)

If the user asks to fix issues after the report, address them in priority order:
1. Critical security issues
2. SEO / OGP issues affecting discoverability
3. Performance issues
4. Accessibility issues
5. Other items
