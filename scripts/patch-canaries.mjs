/**
 * Post-install fixes for the aliased canary builds. Runs from the root `postinstall` hook, so a
 * plain `pnpm install` always leaves node_modules in the state the evaluation assumes.
 *
 * 1. Version splitting (all three aliases). Every canary declares `@base-ui/react@1.7.0` — the
 *    same identity as stable — and TypeScript dedupes declaration files by `name@version`, so
 *    without this each alias silently resolves to stable's types and canary-only APIs "don't
 *    exist" (verified 2026-08-18, see PLAN.md Phase 9). Runtime never reads the field.
 *
 * 2. Exports-map widening (base-ui-5414 only). Its `ListVirtualizer` binds to host contexts that
 *    ship in the tarball under `internals/virtualization/` but are not covered by the exports map.
 *    The standalone issues list has to publish that host itself, so the entry is added here.
 *    Widening the map — rather than a Vite alias to file paths — keeps the specifier root
 *    identical to ListVirtualizer's own imports, so both resolve to the same module instances and
 *    context identity is preserved by construction.
 */

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const CANARIES = [
	{ alias: 'base-ui-5173', version: '1.7.0-pr5173' },
	{ alias: 'base-ui-5414', version: '1.7.0-pr5414', widenExports: true },
	{ alias: 'base-ui-5466', version: '1.7.0-pr5466' },
];

const INTERNALS_ENTRY = {
	import: {
		types: './internals/virtualization/*.d.mts',
		default: './internals/virtualization/*.mjs',
	},
	require: {
		types: './internals/virtualization/*.d.ts',
		default: './internals/virtualization/*.js',
	},
};

let patched = 0;

for (const { alias, version, widenExports } of CANARIES) {
	let manifestPath;

	try {
		// Resolve through the pnpm symlink so the write lands in the virtual store copy.
		manifestPath = realpathSync(join(ROOT, 'node_modules', alias, 'package.json'));
	} catch {
		console.warn(`[patch-canaries] ${alias} is not installed - skipped`);
		continue;
	}

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	let changed = false;

	if (manifest.version !== version) {
		manifest.version = version;
		changed = true;
	}

	if (widenExports && manifest.exports && !manifest.exports['./internals/virtualization/*']) {
		manifest.exports['./internals/virtualization/*'] = INTERNALS_ENTRY;
		changed = true;
	}

	if (changed) {
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		patched += 1;
		console.log(
			`[patch-canaries] ${alias} -> ${version}${widenExports ? ' (+internals exports)' : ''}`,
		);
	}
}

console.log(`[patch-canaries] done, ${patched} manifest(s) written`);
