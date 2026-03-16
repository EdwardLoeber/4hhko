# GRADER.md — 4hhko Analytics

## Live URL

**https://reporting.4hhko.com**

---

## Credentials

| Role | Email | Password | Access level |
|---|---|---|---|
| super_admin | pure@hk.gg | radiance | Full access, user management, all sections |
| analyst | analyst@4hhko.com | hollow-vessel | Dashboard + Insights, Traffic and Errors sections only |
| viewer | viewer@4hhko.com | mawlek-white-temple | Read-only, assigned sections visible in dashboard |

eam:
Edward Loeber

Droplet IP: 144.126.208.55
Web Auth login:
    User: femmy
    Pass: femboy
Grader Account Login:
    User: grader
    pass: 80085haha
    (no ssh key needed)
---

## Grading Scenario

Please follow these steps in order before free-form exploration:

**Step 1 — Log in as super_admin**
- Go to https://reporting.4hhko.com
- Log in with `pure@hk.gg` / `radiance`
- You should land on the Dashboard with Traffic, Errors, and Engagement tabs

**Step 2 — Explore the Dashboard**
- Click through each tab (Traffic → Errors → Engagement)
- Each tab loads some charts, plus scrollable data tables
- Type something in the "Analyst Comment" box at the bottom of a tab — it autosaves after you stop typing (look for the "Saved" confirmation)
- Click "Export PDF" — a download link should appear next to the button (brings you to static html page)

**Step 3 — Visit the Insights page**
- Click "Insights" in the nav
- The page shows summary stats (unique sessions, total pageviews, first/last access) and two tabs: User Overview and Technical Profile
- Switch between the tabs
- Type a comment and export — this generates a two-section PDF with charts for both tabs

**Step 4 — Visit Saved Reports**
- Click "Saved Reports" in the nav
- The two exports you just created should appear here as a chronological list with category badges and Download links
- If you are logged in as super_admin or analyst, a Delete button appears on each entry

**Step 5 — Manage Users**
- Click "Users" in the nav (visible to super_admin only)
- The user table shows all three accounts
- Change the `analyst` user's sections: uncheck "errors", leave only "traffic" checked, click Save — the row should flash "Saved ✓"
- Log out, log in as `analyst@4hhko.com` / `hollow-vessel` — you should now see only the Traffic tab (section change takes effect on next login)

**Step 6 — Log in as viewer**
- Log out, log in as `viewer@4hhko.com` / `mawlek-white-temple`
- The viewer can see the Dashboard and Insights pages but has no export button or comment field
- The viewer does not see the Users link
- Saved Reports is visible and readable

---

## Known Issues and Architectural Concerns

I am being upfront about the following so the grader can apply half-consequence where relevant:

### Viewer section changes require re-login
When a super_admin changes which sections a viewer can see, the change is saved to the database but the viewer's active session still has the old section list. The viewer must log out and back in for the change to take effect. This is a session-staleness problem — the right fix is to either invalidate the user's session on section change or re-read sections from the DB on each request. Currently it just doesn't happen.

### Insights export: Technical Profile charts may render incorrectly
When exporting from the Insights page, the charts on the hidden tab (whichever tab you are *not* currently viewing) are temporarily un-hidden and resized to capture them. If the browser does not complete layout in the 150ms wait window, the Technical Profile charts can appear garbled or blank in the PDF. This is a timing/rendering issue with Chart.js on hidden canvas elements.

### mPDF dependency not installed
The PDF generation library (mPDF) requires `composer install` in `public_html/`. If it is not installed on the grading machine, exports fall back to a static HTML file instead of a PDF. The exported content (charts + data tables) is the same either way — just the file format differs. The download link will point to a `.html` file instead of `.pdf`.

### No CSRF protection
The API uses same-origin session cookies, which provides some protection, but there are no explicit CSRF tokens. This is a known gap.
