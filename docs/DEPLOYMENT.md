# Deployment Guide

This guide covers hosting the React prototype and the production path. The
prototype is a static single-page app; there is no backend, database, or secret in
the bundle.

> **Data rule:** the sample-project pages use fictional data, but the default
> **Live Accomplishments** view ships `public/live-data.json`, generated from the
> actual 2026 workbook. That file contains real EMB data. Do not deploy a build
> containing it to a public static host. Use an authenticated option below, or the
> production Power BI report embedded in SharePoint. For a public design demo,
> remove `public/live-data.json` before building and link only to the sample pages.

---

## 1. Build

```powershell
cd "F:\EMED PROJECT\Planning Dashboards"
npm install
npm run build
npm run preview
```

- Output: `dist/`
- Preview: <http://localhost:4173/>
- `npm run build` runs `tsc --noEmit` first. Fix type errors before deploying.
- The app uses hash routing (`#/tracker/PRJ-2025-006`), so it works on any static
  host without server-side rewrite rules.
- Asset paths are absolute by default (`/assets/...`). If you deploy under a
  subpath such as `https://example.gov.ph/planning/`, set the Vite base:

```ts
// vite.config.ts
export default defineConfig({
  base: '/planning/',
  plugins: [react()],
});
```

Rebuild after changing `base`.

---

## 2. Hosting options

| Option | Authentication | Suitable for real data? | Notes |
| --- | --- | --- | --- |
| **Local / internal review** | None | Only on a trusted machine | `npm run dev` or `npm run preview`. Fastest for stakeholder walkthroughs. |
| **Azure Static Web Apps** | Microsoft Entra ID | Yes, with tenant restriction | Recommended if the prototype will be shared with staff. |
| **Azure App Service** | Easy Auth / Entra ID | Yes | More control over tenant restriction, custom domains, and slots. |
| **Internal IIS** | Windows Authentication | Yes, on the EMB network | Simple if the office already runs IIS. |
| **Power BI in SharePoint** | Power BI / Microsoft 365 | Yes | Recommended long-term path for the live dashboard. |
| **GitHub Pages / Netlify / Vercel** | None by default | **No** | Fine for a public design demo with sample data only. |
| **SharePoint document library** | SharePoint | Not recommended | Modern SharePoint does not reliably execute a SPA from a document library. |

The rest of this guide focuses on the two realistic paths: Azure Static Web Apps
and internal IIS, then the Power BI embed.

---

## 3. Azure Static Web Apps

### 3.1 What you need

- An Azure subscription.
- A GitHub or Azure DevOps repository containing this project.
- Permission to create a Static Web App and an app registration (or a tenant admin
  who can consent).
- A custom domain, optional but recommended.

### 3.2 Create the resource

1. Azure Portal → **Create a resource** → **Static Web App**.
2. Subscription and resource group: use the office's standard naming.
3. Name: e.g., `emb-r7-planning-dashboard`.
4. Plan: **Free** for a pilot, **Standard** for a production SLA and custom auth.
5. Source: GitHub or Azure DevOps; select the repository and the `main` branch.
6. Build presets: **Vite**.
   - App location: `/`
   - Output location: `dist`
   - API location: leave blank.
7. Create. Azure adds a GitHub Actions workflow that builds and deploys on push.

### 3.3 Authentication and tenant restriction

Static Web Apps has built-in Microsoft Entra ID authentication. A starter
`staticwebapp.config.json` is included in
[`deploy/azure-static-web-apps/`](../deploy/azure-static-web-apps/). Copy it to
`public/` so Vite includes it in `dist/`:

```powershell
Copy-Item deploy\azure-static-web-apps\staticwebapp.config.json public\staticwebapp.config.json
npm run build
```

The configuration:

- Requires an authenticated user for every route.
- Redirects unauthenticated users to the Entra ID login.
- Falls back to `index.html` for client-side routes.
- Disables open registration, so users must be invited or assigned a role.

For strict **tenant-only** access, choose one of these:

1. **Invite-only (simplest):** keep `openRegistration: false` and invite each user
   through the Static Web Apps invitation flow. This is manageable for a small
   planning office but does not automatically include the whole tenant.
2. **Custom roles + tenant check:** add a small API (Azure Function) that reads the
   authenticated user's claims and assigns a role only if the tenant ID matches.
   This requires code and a role management process.
3. **Azure App Service + Easy Auth:** configure the Microsoft identity provider
   with **issuer URL** restricted to the EMB tenant. This is the cleanest
   tenant-wide restriction, at the cost of a slightly heavier hosting setup.

Do not rely on hiding the URL. Authentication must be enforced by the host.

### 3.4 Deploy with the SWA CLI (alternative)

```powershell
npm install -g @azure/static-web-apps-cli
npm run build
swa deploy .\dist --env production
```

Follow the CLI prompts to select the subscription and Static Web App. The CLI is
useful for a one-off deployment; the GitHub Actions workflow is better for ongoing
changes.

### 3.5 Custom domain and HTTPS

- Add the custom domain in the Static Web App → **Custom domains**.
- Create the required CNAME/TXT records.
- Wait for certificate provisioning.
- Enforce HTTPS.
- Test with a non-owner account.

### 3.6 Headers

Static Web Apps supports security headers in `staticwebapp.config.json`:

```json
{
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  }
}
```

Vite's production build does not use inline scripts, so `script-src 'self'` is
usually sufficient. The app uses inline styles for chart colors and a few
components, so `style-src 'unsafe-inline'` is required unless you refactor those
styles. Test the CSP in report-only mode first; a strict CSP can break the app.

If you later embed Power BI in an iframe, add
`frame-src https://app.powerbi.com` and the relevant Power BI domains. For the
standalone React app, `frame-ancestors 'none'` prevents clickjacking.

---

## 4. Internal IIS

Use this if the office has a Windows server and wants the prototype on the
intranet without Azure.

### 4.1 Prerequisites

- IIS with the **Static Content** and **Windows Authentication** roles.
- **No URL Rewrite module required.** The app uses hash routing.
- A DNS name or server IP reachable from the office network.
- A TLS certificate for HTTPS. Do not serve over plain HTTP on a shared network.

### 4.2 Deploy

1. Build:

   ```powershell
   npm run build
   ```

2. Copy the contents of `dist/` to a folder, e.g.:

   ```text
   C:\inetpub\wwwroot\planning-dashboard\
   ```

3. Create an IIS site or application pointing to that folder.
4. Add MIME types if they are missing:

   | Extension | MIME type |
   | --- | --- |
   | `.js` | `text/javascript` |
   | `.mjs` | `text/javascript` |
   | `.css` | `text/css` |
   | `.json` | `application/json` |
   | `.svg` | `image/svg+xml` |
   | `.woff2` | `font/woff2` |

5. Enable **Windows Authentication**, disable **Anonymous Authentication** for the
   site.
6. Grant read access to the site's application pool identity or the authenticated
   users group.
7. Browse to `https://<server>/planning-dashboard/`.

A sample `web.config` is in [`deploy/iis/`](../deploy/iis/). It:

- Allows Windows authentication and disables anonymous access.
- Sets correct MIME types for JSON, SVG, and WOFF2.
- Adds basic security headers.
- Disables client caching to avoid stale deployments after an update.

> If you deploy at a subpath, set Vite's `base` to that subpath and rebuild.
> Otherwise the assets will 404.
>
> The sample intentionally does **not** include a URL Rewrite rule. Hash routing
> works without one, and an IIS server without the URL Rewrite module will reject
> a `web.config` that contains a `<rewrite>` section. Add a fallback rule only if
> you later switch away from hash routing.

### 4.3 IIS checklist

- [ ] HTTPS works; HTTP redirects to HTTPS.
- [ ] Windows Authentication prompts and accepts an EMB account.
- [ ] Anonymous access is disabled.
- [ ] The app loads at `/planning-dashboard/`.
- [ ] Deep link `#/tracker/PRJ-2025-006` works after a refresh.
- [ ] Assets return 200, not 404.
- [ ] The server has no directory browsing.
- [ ] The app is reachable only from the intended network/VPN.

---

## 5. Power BI embedded in SharePoint (production path)

Once the report is published:

1. Publish the `.pbix` to the `EMB R7 Planning` workspace.
2. Create and publish the Power BI app.
3. Edit the target SharePoint page (e.g., the Planning Office home page).
4. Add the **Power BI** web part.
5. Select the workspace and report.
6. Set the page audience to the planning staff and executives.
7. Test with a viewer account, not a workspace owner.
8. Add a short "How to use this report" section and a link to the SharePoint
   tracker for edits.

Licensing: viewers need Power BI Pro/PPU, or the workspace must be backed by
Premium/Fabric capacity. Embedding does not bypass licensing. Confirm before
announcing the rollout.

Do not use **Publish to web** for an internal report. It creates an anonymous
public link.

---

## 6. Future SharePoint/Graph integration

The current app imports static data from `src/data/`. If the office wants a live
React app instead of Power BI, the safe architecture is:

```text
React SPA (Entra ID sign-in)
        │  HTTPS + bearer token
        ▼
Azure Function / API  ──►  Microsoft Graph  ──►  SharePoint lists
        │
        └── server-side validation, caching, audit
```

### Rules

- **Never put a client secret in the SPA.** Anything in the bundle is public.
- Use the authorization code flow with PKCE for user sign-in (MSAL).
- Prefer delegated permissions with `Sites.Selected` for the specific site.
- For app-only access, use a confidential client with a certificate or managed
  identity, server-side only.
- Validate the token audience, issuer, and tenant on the API.
- Apply the same field validation and permissions as the SharePoint forms.
- Cache reads for a short period; do not call Graph on every keystroke.
- Log writes with the user's identity and a timestamp.

### Minimal permissions

| Operation | Permission |
| --- | --- |
| Read lists | `Sites.Selected` (recommended) or `Sites.Read.All` delegated |
| Write list items | `Sites.Selected` with read/write, or `Lists.ReadWrite.All` delegated |
| Read user profile | `User.Read` |

Admin consent is required for application permissions and often for
`Sites.Selected`. Request the smallest scope that works.

### Why Power BI is still the better production path

- The office already has Microsoft 365.
- Power BI provides refresh, security, sharing, export, mobile, and embedding
  without custom code.
- The React app would need authentication, an API, validation, error handling, and
  ongoing maintenance.
- Keep the React app as the UX prototype and stakeholder demo; use Power BI for the
  live report.

---

## 7. Security checklist

- [ ] HTTPS everywhere; HSTS enabled at the host.
- [ ] Authentication enforced by the host or an API, not by client-side routing.
- [ ] Tenant restriction tested with a personal Microsoft account (must fail).
- [ ] No secrets, connection strings, or real data in the repository.
- [ ] `.env` files ignored; deployment secrets stored in GitHub/Azure settings.
- [ ] Content-Security-Policy tested; no unnecessary `unsafe-eval`.
- [ ] `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] No public `Publish to web` link.
- [ ] Dependencies reviewed and updated; run `npm audit` in the office network or
      against your approved registry.
- [ ] Access reviewed quarterly; remove leavers promptly.
- [ ] Backups/version history for the SharePoint lists and the Power BI report.
- [ ] Data retention agreed for updates and exported CSV files.
- [ ] Browser storage contains no sensitive data (the prototype uses none).

---

## 8. Release and rollback

### Versioning

- Update `package.json` `version` and `src/data/meta.ts` `APP_VERSION` for each
  release.
- Tag the repository (e.g., `v0.1.0`).
- Keep the previous `dist/` artifact or a deployment slot.

### Smoke test after deploy

1. Open the app at the production URL.
2. Confirm the Overview loads and KPI numbers are present.
3. Change a filter; confirm the table updates.
4. Open a project via `#/tracker/PRJ-2025-006`; confirm the drawer opens.
5. Click Export; confirm a CSV downloads.
6. Check the Timeline and Data Quality pages.
7. Check the browser console for 404s or CSP errors.
8. Test on a phone-width viewport.
9. For an authenticated host, test with a viewer account and with an account
   outside the tenant.

### Rollback

- **Azure Static Web Apps:** redeploy the previous commit or use the deployment
  history; staging environments can be swapped.
- **Azure App Service:** use a deployment slot swap.
- **IIS:** keep the previous `dist` folder as `planning-dashboard.previous` and
  switch the site path, or copy it back.
- **Power BI:** keep the previous `.pbix` version; republish if a report change
  breaks a page. Dataset changes should be tested in a separate workspace first.

---

## 9. Monitoring and support

| Item | Recommendation |
| --- | --- |
| **Uptime** | A simple HTTPS check every 5 minutes from an internal or Azure monitor. |
| **Errors** | Application Insights (Azure) or IIS logs; review weekly during the pilot. |
| **CSP reports** | Add a `report-uri` or `report-to` endpoint if using a strict CSP. |
| **Power BI refresh** | Enable failure notifications; check the refresh history weekly. |
| **Flows** | Review run history weekly; fix failures before they become silent. |
| **Support contact** | Put a named owner and email on the About page and the SharePoint page. |
| **Review cadence** | Quarterly access review; annual architecture review. |

The React prototype makes no external network calls, so there is no API to monitor.
If a backend is added, monitor its latency, error rate, and Graph throttling
(HTTP 429 with `Retry-After`).

---

## 10. Deployment decision summary

| Situation | Recommended path |
| --- | --- |
| Stakeholder review this week, sample data only | Local `npm run dev` or `npm run preview`. |
| Share the prototype with staff, sample data only | Azure Static Web Apps with Entra ID, or internal IIS with Windows Auth. |
| Real data, read-only dashboard | Power BI report embedded in SharePoint. |
| Real data, in-app editing | Do not build it in the prototype; use SharePoint lists and Power Automate/Power Apps, or a custom API with Entra ID. |
| Public design portfolio | Static host with sample data, clearly labeled. Never with real names or budgets. |

When in doubt, keep the prototype local and put the live data in Power BI. The
prototype's job is to prove the UX, not to become a second system of record.
