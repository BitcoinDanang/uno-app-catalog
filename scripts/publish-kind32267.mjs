#!/usr/bin/env node
/**
 * Mirror catalog entries to Khatru-Uno as Zapstore-compatible kind:32267 events.
 *
 * NOT RUN AUTOMATICALLY YET.  A curator key has not been designated for the
 * Uno catalog.  When one exists, set CURATOR_NSEC and CATALOG_RELAYS and run:
 *
 *   CURATOR_NSEC=nsec1... \
 *   CATALOG_RELAYS=wss://khatru.nostr.uno \
 *   node scripts/publish-kind32267.mjs
 *
 * Per spec: kind:32267 is parameterised-replaceable, keyed by `d` = catalog id.
 * Tags used here mirror what Zapstore expects: d, name, url, description,
 * t (categories), L/l (identityType labels), and a `nip46` flag tag.
 *
 * NDK is the canonical Nostr lib for Uno (see CLAUDE.md and project memory).
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const catalogPath = resolve(root, 'dist', 'catalog.json');

const nsec = process.env.CURATOR_NSEC;
const relayList = (process.env.CATALOG_RELAYS || 'wss://khatru.nostr.uno').split(',').map((r) => r.trim()).filter(Boolean);

if (!nsec) {
	console.error('CURATOR_NSEC is required. The curator Nostr key has not been designated for this catalog yet.');
	console.error('When the key is assigned, run with CURATOR_NSEC=nsec1... CATALOG_RELAYS=wss://...');
	process.exit(2);
}

// Lazy-load NDK so a missing peer dep doesn't break the dry-run path above.
const { default: NDK, NDKEvent, NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const signer = new NDKPrivateKeySigner(nsec);
const ndk = new NDK({ explicitRelayUrls: relayList, signer });
await ndk.connect();

let published = 0;
for (const app of catalog.apps) {
	const evt = new NDKEvent(ndk);
	evt.kind = 32267;
	evt.tags = [
		['d', app.id],
		['name', app.name],
		['url', app.url],
		['description', app.description],
		['nip46', app.nip46Support ? 'true' : 'false']
	];
	for (const c of app.categories || []) evt.tags.push(['t', c]);
	for (const it of app.identityTypes || []) evt.tags.push(['L', 'uno.identity'], ['l', it, 'uno.identity']);
	if (app.icon) evt.tags.push(['image', app.icon]);
	for (const b of app.badges || []) evt.tags.push(['badge', b]);
	evt.content = app.description;

	await evt.publish();
	published += 1;
	console.log(`Published kind:32267 d=${app.id}`);
}

console.log(`Done. Published ${published}/${catalog.apps.length} entries to ${relayList.join(', ')}.`);
process.exit(0);
