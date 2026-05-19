#!/usr/bin/env node
/**
 * Publish dist/catalog.json to the `uno-app-catalog` R2 bucket.
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN  - token with R2 write scope
 *   CLOUDFLARE_ACCOUNT_ID - account that owns the bucket (default: nostr.uno account)
 *
 * Uses the R2 single-object PUT REST endpoint so we don't need wrangler.
 * Object key is `catalog.json`. Cache-Control is set to 5 minutes so the
 * R2-public-domain edge cache and client both refresh promptly after a merge.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const distFile = resolve(root, 'dist', 'catalog.json');

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'a3e337b3f5fdb023ed713e70c223e51a';
const bucket = process.env.R2_BUCKET || 'uno-app-catalog';
const key = process.env.R2_OBJECT_KEY || 'catalog.json';

if (!token) {
	console.error('CLOUDFLARE_API_TOKEN is required');
	process.exit(2);
}

const info = await stat(distFile).catch(() => null);
if (!info) {
	console.error(`Missing ${distFile}. Run \`pnpm build\` first.`);
	process.exit(2);
}

const body = await readFile(distFile);
const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;

const res = await fetch(url, {
	method: 'PUT',
	headers: {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
		'Cache-Control': 'public, max-age=300'
	},
	body
});

if (!res.ok) {
	console.error(`R2 upload failed: HTTP ${res.status}`);
	console.error(await res.text());
	process.exit(1);
}

console.log(`Uploaded ${distFile} -> r2://${bucket}/${key} (${body.length} bytes)`);
