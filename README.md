# 4hhko Analytics — CSE 135 Final Project

## Links

- **Repository:** https://github.com/EdwardLoeber/4hhko
- **Test site (instrumented):** https://test.4hhko.com
- **Collector endpoint:** https://collector.4hhko.com
- **Reporting dashboard:** https://reporting.4hhko.com

---

## Technical Overview

### Architecture

Four subdomains, each serving a distinct role:

| Subdomain | Purpose |
|---|---|
| `test.4hhko.com` | Six-page instrumented website that generates real analytics data |
| `collector.4hhko.com` | Beacon ingestion endpoint (`collect.php` + `collector.js`) |
| `reporting.4hhko.com` | Private analytics dashboard (PHP session auth + role-based access) |
| `4hhko.com` | Main site |

### Data Pipeline

1. A visitor loads a page on `test.4hhko.com`
2. `collector.js` fires beacons for pageviews, activity events, errors, page exits, and custom events via a `_cq` queue pattern
3. `collect.php` on `collector.4hhko.com` validates, enriches, and writes each beacon to PostgreSQL
4. `reporting.4hhko.com` reads from the same PostgreSQL database via a REST API (`api.php`) and renders charts and tables in the browser

### Stack

- **Backend:** PHP 8, Apache 2 with mod_rewrite + ModSecurity (OWASP CRS 3.3.5)
- **Database:** PostgreSQL — database `analytics`, tables: `pageviews`, `activity_events`, `errors`, `page_exits`, `events`, `users`, `report_comments`
- **Frontend:** Vanilla JS, Chart.js, PicoCSS (classless v2)
- **PDF export:** mPDF (falls back to static HTML file if library unavailable)
- **Auth:** PHP session cookie (`sid`), bcrypt-hashed passwords, role-based access control

### Dashboard Features

- **Dashboard** — Traffic, Errors, and Engagement tabs, each with two Chart.js charts (thin bar charts spanning the full date range), scrollable data tables, a debounced analyst comment box, and a PDF export button
- **Insights** — Session-level user behavior analytics split into User Overview (sessions/day, language, timezone) and Technical Profile (browser, OS, screen resolution, device memory, network type, color scheme) tabs with export
- **Saved Reports** — Chronological feed of the 10 most recent exports across all categories, accessible to all authenticated users; oldest entry auto-deleted when the cap is exceeded
- **Users** — Super-admin-only CRUD interface: create users, assign roles and section permissions, delete users
- **Role system:**
  - `super_admin` — full access including user management
  - `analyst` — dashboard, insights, export, comment; visible sections are configurable
  - `viewer` — read-only access to their explicitly assigned sections; no export or comment capability

## Use of AI

This project used Claude (Anthropic) as a coding assistant throughout development — architecture decisions, debugging, PHP/JS implementation, SQL queries, and server error diagnosis were all done collaboratively with Claude Code in a pair-programming style. All AI output was reviewed and tested before deployment.

**Observations on value:**

AI was highly effective for this kind of project. The biggest wins were: (1) diagnosing server errors from raw Apache logs — identifying specific ModSecurity rule IDs and proposing workarounds took seconds instead of hours; (2) generating consistent boilerplate across many similar files (API routes, view templates, chart configurations); (3) maintaining naming and structural conventions across a codebase that grew organically over many sessions.

The main limitation was with multi-file refactors. When a change touched several files simultaneously, occasional regressions appeared that required careful review. AI also tended toward over-engineering on first pass (adding unnecessary abstraction layers), which required pushback. Overall the productivity gain was substantial — this project would have taken significantly longer without it.

---

## Roadmap

Things I would have done given more time, roughly in priority order:

1. **Live section updates** — changes to a user's sections should take effect immediately without requiring a re-login; sessions should be refreshed from the DB or invalidated on section change
2. **Date range filtering** — allow analysts to select a custom date range for all charts and tables rather than showing all-time data
3. **Insights export fidelity** — charts in the Technical Profile tab can render incorrectly in exports when they were on a hidden tab at export time; a more reliable off-screen rendering solution is needed
4. **Per-session drill-down** — clicking a session row in the Insights table should expand or navigate to a full timeline of that session's events
5. **Automated data retention** — data currently grows unbounded in PostgreSQL; a scheduled job to prune records older than a configurable window is needed for production use
6. **Mobile layout** — responsive breakpoints exist but the data tables are awkward on narrow screens
7. **CSRF protection** — the API relies on same-origin session cookies; explicit CSRF tokens would be a meaningful security improvement
8. **Error rate alerting** — notify analysts via email or webhook when error rate spikes above a threshold
