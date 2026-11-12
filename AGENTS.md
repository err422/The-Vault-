<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## The Vault (project rules)

- The WebOS is plain browser JavaScript under `src/vault/` (migrated from the original vanilla site); `src/routes/index.tsx` renders the original page skeleton and dynamically imports `src/vault/boot.js` after hydration. Why: the OS touches `window`/`document` at import time and must never run during SSR.
- The backend is the owner's existing Firebase project (Auth + Realtime Database, compat SDK loaded from gstatic in `boot.js`); do not move vault data to Lovable Cloud. Why: the owner manages Firebase directly and keeps existing users there.
- `src/vault/shared/*.js` are classic scripts injected inline via `?raw`, not ES modules. Why: they rely on sloppy-mode globals (`auth`, `database`) from `FirebaseConfig.js`.
- The site is WebOS-only; classic mode was removed. Why: the owner retired it.
- Tailwind preflight is intentionally not imported in `src/styles.css`. Why: the original Vault stylesheets rely on browser default styles.
- Hosting is GitHub Pages (static files): `vite.config.ts` prerenders `/` and `.github/workflows/deploy-pages.yml` publishes `dist/client`. Why: the owner hosts for free on GitHub Pages, so no server functions, server routes or per-request rendering may be added.
