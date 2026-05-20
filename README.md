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

This repo implements R-DISCOVER **Phase A** (catalog foundation) and the
**Phase B-006** editorial-calendar signing workflow. The per-identity ranker
(Phase C) lives in the Uno client.

## Editorial workflow (Phase B-006)

`editorial-calendar.json` plans daily/weekly hero rotation per identity type.
Each entry becomes one `kind:30403` event published to Khatru-Uno.

Schema:

```json
{
  "date": "YYYY-MM-DD",
  "slot": "today_hero | featured | new | category_lead_<cat>",
  "identityType": "social | chat | work | dev | anon",
  "appId": "primal",         // must exist in catalog.json
  "ttlHours": 36              // event treated as expired after date+ttl
}
```

Workflow:

1. Edit `editorial-calendar.json` (PR review, same as catalog entries).
2. `pnpm editorial:check` validates entries against `catalog.json`.
3. Merge to main.
4. Maintainer runs locally:
   ```bash
   CURATOR_NSEC=$(jq -r .nsec /Users/bowz/uno-connect-editorial-key.json) \
   CATALOG_RELAYS=wss://relay.nostr.uno \
   pnpm editorial:publish
   ```
5. Khatru-Uno's accept-list pins the editorial pubkey; events from any other
   key are rejected with `restricted: kind 30403 only allowed for the
   editorial signing key`. Clients pick up the new slot within 5 minutes.

The `d`-tag is `editorial:<slot>:<identityType>` so re-publishing for the
same slot atomically replaces the previous hero (NIP-33).
