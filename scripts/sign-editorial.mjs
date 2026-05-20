#!/usr/bin/env node
/**
 * R-DISCOVER B-006 — sign + publish editorial events (kind:30403) to
 * Khatru-Uno from editorial-calendar.json.
 *
 * Each calendar entry becomes one kind:30403 event with the d-tag
 * "editorial:<slot>:<identityType>". Khatru-Uno's accept-list (B-003) pins
 * the editorial editor pubkey as the sole publisher — this script will fail
 * loudly if CURATOR_NSEC does not match that pubkey.
 *
 * Usage:
 *
 *   CURATOR_NSEC=$(jq -r .nsec /Users/bowz/uno-connect-editorial-key.json) \
 *   CATALOG_RELAYS=wss://relay.nostr.uno \
 *   node scripts/sign-editorial.mjs
 *
 * Optional:
 *   --check        validate calendar entries against catalog.json (no publish)
 *   --slot=<slot>  publish only entries matching this slot
 *   --type=<type>  publish only entries matching this identityType
 *
 * NDK is the canonical Nostr lib for Uno (see CLAUDE.md).
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const calendarPath = resolve(root, 'editorial-calendar.json');
const catalogPath = resolve(root, 'catalog.json');

const EXPECTED_EDITOR_PUBKEY = 'ec5ad438d2f997630eeb6170c951dcc167bee7b492cbefcebea90a244ca1c163';
const VALID_SLOTS = new Set(['today_hero', 'featured', 'new']);
const VALID_TYPES = new Set(['social', 'chat', 'work', 'dev', 'anon']);

function parseArgs(argv) {
	const args = { check: false, slot: null, type: null };
	for (const a of argv) {
		if (a === '--check') args.check = true;
		else if (a.startsWith('--slot=')) args.slot = a.slice('--slot='.length);
		else if (a.startsWith('--type=')) args.type = a.slice('--type='.length);
	}
	return args;
}

function isValidSlot(slot) {
	if (VALID_SLOTS.has(slot)) return true;
	if (slot.startsWith('category_lead_') && slot.length > 'category_lead_'.length) return true;
	return false;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const calendar = JSON.parse(await readFile(calendarPath, 'utf8'));
	const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
	const catalogIds = new Set(catalog.apps.map((a) => a.id));

	// Validate calendar entries up front so we fail fast.
	const errors = [];
	const filtered = [];
	for (const [idx, entry] of (calendar.entries ?? []).entries()) {
		const ctx = `entries[${idx}] (${entry.slot}:${entry.identityType}:${entry.appId})`;
		if (!isValidSlot(entry.slot)) errors.push(`${ctx}: invalid slot ${JSON.stringify(entry.slot)}`);
		if (!VALID_TYPES.has(entry.identityType))
			errors.push(`${ctx}: invalid identityType ${JSON.stringify(entry.identityType)}`);
		if (!catalogIds.has(entry.appId))
			errors.push(`${ctx}: appId ${JSON.stringify(entry.appId)} not present in catalog.json`);
		if (!entry.date) errors.push(`${ctx}: missing date`);
		if (!entry.ttlHours || entry.ttlHours <= 0)
			errors.push(`${ctx}: ttlHours must be > 0`);

		if (args.slot && entry.slot !== args.slot) continue;
		if (args.type && entry.identityType !== args.type) continue;
		filtered.push(entry);
	}

	if (errors.length > 0) {
		console.error('editorial-calendar.json has', errors.length, 'error(s):');
		for (const e of errors) console.error('  -', e);
		process.exit(2);
	}

	if (args.check) {
		console.log(`OK: ${filtered.length}/${calendar.entries.length} editorial entries valid.`);
		process.exit(0);
	}

	const nsec = process.env.CURATOR_NSEC;
	if (!nsec) {
		console.error('CURATOR_NSEC is required (export the value, do not paste inline).');
		console.error('Read it from /Users/bowz/uno-connect-editorial-key.json with:');
		console.error('  CURATOR_NSEC=$(jq -r .nsec /Users/bowz/uno-connect-editorial-key.json)');
		process.exit(2);
	}

	const relayList = (process.env.CATALOG_RELAYS || 'wss://relay.nostr.uno')
		.split(',')
		.map((r) => r.trim())
		.filter(Boolean);

	const { default: NDK, NDKEvent, NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
	const signer = new NDKPrivateKeySigner(nsec);
	const user = await signer.user();
	if (user.pubkey !== EXPECTED_EDITOR_PUBKEY) {
		console.error(
			`Signer pubkey ${user.pubkey} does not match the editorial editor pubkey ${EXPECTED_EDITOR_PUBKEY}.`
		);
		console.error(
			'Khatru-Uno will reject events from this key. Check that CURATOR_NSEC points at the editorial key, not a catalog curator key.'
		);
		process.exit(3);
	}

	const ndk = new NDK({ explicitRelayUrls: relayList, signer });
	await ndk.connect();

	let published = 0;
	for (const entry of filtered) {
		const expiresAt = Math.floor(
			new Date(entry.date + 'T00:00:00Z').getTime() / 1000 + entry.ttlHours * 3600
		);
		const payload = {
			slot: entry.slot,
			identityType: entry.identityType,
			appId: entry.appId,
			expiresAt,
		};
		const evt = new NDKEvent(ndk);
		evt.kind = 30403;
		evt.tags = [
			['d', `editorial:${entry.slot}:${entry.identityType}`],
			['app', entry.appId],
			['identity-type', entry.identityType],
			['expires', String(expiresAt)],
		];
		evt.content = JSON.stringify(payload);
		await evt.publish();
		published += 1;
		console.log(
			`Published kind:30403 d=editorial:${entry.slot}:${entry.identityType} app=${entry.appId} expiresAt=${expiresAt}`
		);
	}

	console.log(
		`Done. Published ${published}/${filtered.length} editorial event(s) to ${relayList.join(', ')}.`
	);
	process.exit(0);
}

main().catch((err) => {
	console.error('sign-editorial.mjs failed:', err);
	process.exit(1);
});
