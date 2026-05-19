#!/usr/bin/env node
/**
 * Build script for uno-app-catalog.
 *
 * - Loads schema.json + catalog.json
 * - Validates every entry against the schema (Ajv)
 * - Enforces unique `id` and that the file parses as valid JSON
 * - Emits dist/catalog.json (the artifact shipped to R2 at catalog.nostr.uno)
 *
 * Usage:
 *   pnpm install
 *   pnpm build            # writes dist/catalog.json
 *   node scripts/build.mjs --check   # validate only, no write
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const schemaPath = resolve(root, 'schema.json');
const catalogPath = resolve(root, 'catalog.json');
const distDir = resolve(root, 'dist');
const distFile = resolve(distDir, 'catalog.json');

const checkOnly = process.argv.includes('--check');

async function loadJson(p) {
	const raw = await readFile(p, 'utf8');
	try {
		return JSON.parse(raw);
	} catch (err) {
		throw new Error(`Invalid JSON in ${p}: ${err.message}`);
	}
}

async function main() {
	const schema = await loadJson(schemaPath);
	const catalog = await loadJson(catalogPath);

	if (!Array.isArray(catalog.apps)) {
		throw new Error('catalog.json must have an `apps` array at the top level');
	}

	const ajv = new Ajv2020({ allErrors: true, strict: false });
	addFormats(ajv);
	const validate = ajv.compile(schema);

	const errors = [];
	const seenIds = new Set();
	for (const [idx, entry] of catalog.apps.entries()) {
		const ok = validate(entry);
		if (!ok) {
			for (const e of validate.errors ?? []) {
				errors.push(`apps[${idx}] (${entry.id ?? '?'}): ${e.instancePath} ${e.message}`);
			}
		}
		if (entry.id) {
			if (seenIds.has(entry.id)) {
				errors.push(`apps[${idx}]: duplicate id "${entry.id}"`);
			}
			seenIds.add(entry.id);
		}
	}

	if (errors.length) {
		console.error('Catalog validation failed:');
		for (const e of errors) console.error('  -', e);
		process.exit(1);
	}

	console.log(`OK: ${catalog.apps.length} catalog entries valid against schema.json`);

	if (checkOnly) return;

	await mkdir(distDir, { recursive: true });
	// Stamp the artifact with a build timestamp.
	const artifact = {
		...catalog,
		updatedAt: new Date().toISOString()
	};
	await writeFile(distFile, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
	console.log(`Wrote ${distFile}`);
}

main().catch((err) => {
	console.error(err.stack ?? err.message ?? err);
	process.exit(1);
});
