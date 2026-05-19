# Contributing to uno-app-catalog

Thanks for helping grow the Nostr Uno app catalog. This repo is the source of
truth for the in-app launcher and discovery surfaces.

## Listing a new app

1. Fork this repo and create a branch off `main`.
2. Add an entry to `catalog.json` under `apps`. Required fields:
   - `id` — stable kebab-case identifier (lowercase, digits, hyphens)
   - `name` — display name (<=64 chars)
   - `url` — https URL of the app
   - `description` — one-line summary (<=280 chars)
   - `identityTypes` — at least one of: `social`, `chat`, `work`, `dev`, `anon`
   - `categories` — at least one (see `schema.json` enum)
   - `nip46Support` — true/false (does the app support NIP-46 remote signing today?)
3. Optional fields: `icon`, `badges`, `zapstoreKind32267Mirror`.
4. Run validation:
   ```bash
   pnpm install
   pnpm check
   ```
5. Open a PR. CI runs the same `pnpm check`. A maintainer merges once it passes.

## Editing an existing entry

Same flow — edit the entry in place. Do **not** change its `id` (clients use
that as the stable key). If you need to retire an app, delete the entry; a
follow-up release can also remove the matching `kind:32267` event.

## Review checklist (for maintainers)

- [ ] `pnpm check` passes
- [ ] App URL resolves over https
- [ ] `identityTypes` make sense (avoid blanket "all of them")
- [ ] `nip46Support` reflects current reality, not aspiration
- [ ] No duplicate `id`s
- [ ] Description is descriptive (not pure marketing copy)

## After merge

Merging to `main` triggers the publish workflow:

1. `pnpm build` (validate + write `dist/catalog.json`)
2. `pnpm publish:r2` (upload to `r2://uno-app-catalog/catalog.json`)

The Uno client picks up the new catalog on its next launch (5-minute memory
cache + R2 edge cache).

## Out of scope here

- Editorial hero rotation (`kind:30403`) — handled by Phase B in the Uno
  client repo, signed by a separate editor key.
- Per-identity ranker / signals — handled by the Uno client.
