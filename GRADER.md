# GRADER.md — 4hhko Analytics HW5

## Live URL
`https://reporting.4hhko.com`

---

## Test Credentials

| Role        | Email             | Password              | Notes                          |
|-------------|-------------------|-----------------------|--------------------------------|
| super_admin | pure@hk.gg        | radiance              | Full access, user management   |
| analyst     | analyst@4hhko.com | hollow-vessel         | Traffic + Errors sections only |
| viewer      | viewer@4hhko.com  | mawlek-white-temple   | Read-only saved reports        |

## HW5 Feature Walkthrough

### 1. Three User Roles

**super_admin (`pure@hk.gg`)**
- Login → redirected to `/dashboard.php`
- Sees all 3 report tabs: Traffic, Errors, Engagement
- Nav shows "Users" link → `/users.php`
- Can add/edit/delete users and assign roles + sections
- Can write analyst comments on all categories
- Can export any report as PDF

**analyst (`analyst@4hhko.com`)**
- Login → redirected to `/dashboard.php`
- Sees only Traffic and Errors tabs (sections: `{traffic,errors}`)
- Cannot see Users link
- Can write/autosave comments on visible sections
- Can export reports

**viewer (`viewer@4hhko.com`)**
- Login → redirected to `/saved.php`
- Sees only saved analyst comments (read-only)
- No dashboard access, no export button
- Direct navigation to `/dashboard.php` redirects back to `/saved.php`

---

### 2. Three Report Categories

Each tab contains:
- **Two Chart.js charts** (line + bar charts)
- **Data table(s)** from the analytics DB
- **Analyst comment** textarea (autosaves after 800ms debounce)
- **Export PDF** button → calls `/export.php?category=...` → returns URL

| Category   | Charts                                  | Tables                          |
|------------|-----------------------------------------|---------------------------------|
| Traffic    | Pageviews/day (line), Top 10 URLs (bar) | pageviews, page_exits           |
| Errors     | Errors/day (bar), Top messages (bar)    | errors                          |
| Engagement | Activity/day (line), Event types (bar)  | activity_events, events         |

---

### 3. Export System

- Endpoint: `GET /export.php?category={traffic|errors|engagement}`
- Generates a PDF via mPDF (or HTML fallback if mPDF unavailable)
- Saves file to `/exports/` directory on the server
- Returns `{ "url": "/exports/filename.pdf" }` — link appears next to Export button
- File is accessible at the returned URL

---

### 4. CSS Framework

- **Pico CSS** (classless, v2) loaded via CDN
- Applied to all pages: dashboard, login, saved reports, user management, error pages
- No Bootstrap classes needed — styles semantic HTML elements directly

---

### 5. Error Pages

- `403 Forbidden` — served by `/403.php` (configured in `.htaccess`)
- `404 Not Found` — served by `/404.php` (configured in `.htaccess`)

---

### 6. API Routes

| Method | Route                  | Access        | Description                    |
|--------|------------------------|---------------|--------------------------------|
| POST   | /api/login             | public        | Authenticate, set session      |
| GET    | /api/reports/{cat}     | authenticated | Report data for category       |
| GET    | /api/comments          | auth          | Current user's comments        |
| POST   | /api/comments          | analyst+      | Upsert comment for category    |
| GET    | /api/saved             | authenticated | All analyst comments           |
| GET    | /api/users             | super_admin   | List all users                 |
| POST   | /api/users             | super_admin   | Create user                    |
| PUT    | /api/users/{id}        | super_admin   | Update role/sections           |
| DELETE | /api/users/{id}        | super_admin   | Delete user                    |
| GET    | /api/pageviews etc.    | authenticated | Raw table access (read-only)   |

---

## Architecture Notes

- **MVC pattern**: controller files (`dashboard.php`, `saved.php`, `users.php`) handle auth and include view files; views are pure HTML/PHP presentation; JS client handles all data fetching.
- **Session guard**: `auth.php` is required at the top of every protected controller; defines `CURRENT_USER_ROLE`, `CURRENT_USER_SECTIONS`, `canSeeSection()`.
- **PostgreSQL TEXT[]**: sections stored as `{traffic,errors}` string in DB; parsed in PHP with `trim`/`explode`.
- **Debounced autosave**: comment textareas save 800ms after the user stops typing.

## Known Issues / Limitations

- Export PDF requires mPDF (`composer require mpdf/mpdf` in public_html). Falls back to HTML file if vendor not present.
- Charts require data in DB; if tables are empty, charts render with no data points.
- The `exports/` directory must exist and be writable by the web server (`www-data`).
