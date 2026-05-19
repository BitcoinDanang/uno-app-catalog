# uno-app-catalog

Source of truth for the **Nostr Uno** in-app catalog (R-DISCOVER Phase A).

The Uno client (iOS / Android / PWA) fetches the catalog from
`https://catalog.nostr.uno/catalog.json` on launch and merges it with any
local fallback. To list, edit, or remove an app, **open a PR against this
repo** — the merge-to-`main` build job validates, packages, and publishes the
new catalog to Cloudflare R2.

- Spec: `schema.json` (JSON Schema 2020-12)
- Catalog: `catalog.json`
- Build artifact: `dist/catalog.json`
- Public URL: <https://catalog.nostr.uno/catalog.json>

## Local dev

```bash
pnpm install
pnpm check     # validate catalog.json against schema.json
pnpm build     # validate + emit dist/catalog.json
```

## Publishing (CI does this on merge to main)

```bash
CLOUDFLARE_API_TOKEN=cfat_... pnpm publish:r2
```

See `CONTRIBUTING.md` for the PR / review checklist.

## Phase A scope

This repo currently implements R-DISCOVER **Phase A only** (catalog
foundation). Editorial events (`kind:30403`) and per-identity ranker live in
Phase B/C and are not handled here yet.
