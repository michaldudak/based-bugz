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
import { createRequire } from 'node:module';
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

function resolveUtilsManifest(fromDir) {
	try {
		const requireFrom = createRequire(join(realpathSync(fromDir), 'package.json'));
		return requireFrom.resolve('@base-ui/utils/package.json');
	} catch {
		return null;
	}
}

/**
 * The canaries resolve to the canary `@base-ui/utils` (see .pnpmfile.cjs), which declares the
 * same version as the published one — the same TypeScript identity hazard as the canaries
 * themselves, so it gets the same split. Guarded by comparing against stable's resolved utils:
 * if both point at one instance something about the resolution went wrong, and renaming the copy
 * stable relies on would be worse than failing loudly.
 */
function patchCanaryUtils(rootDir) {
	const stableManifest = resolveUtilsManifest(join(rootDir, 'node_modules', '@base-ui', 'react'));
	const canaryManifest = resolveUtilsManifest(join(rootDir, 'node_modules', 'base-ui-5466'));

	if (canaryManifest === null) {
		console.warn('[patch-canaries] could not resolve the canary @base-ui/utils - skipped');
		return false;
	}

	if (canaryManifest === stableManifest) {
		throw new Error(
			'[patch-canaries] canaries and stable resolve @base-ui/utils to the same instance — ' +
				'the .pnpmfile.cjs hook did not apply. Refusing to rename a shared manifest; ' +
				'run pnpm install again so the hook participates in resolution.',
		);
	}

	// Undo any accidental rename of the shared instance by an earlier version of this script.
	if (stableManifest !== null) {
		const stable = JSON.parse(readFileSync(stableManifest, 'utf8'));

		if (stable.version !== '0.3.2') {
			stable.version = '0.3.2';
			writeFileSync(stableManifest, `${JSON.stringify(stable, null, 2)}\n`);
			console.log('[patch-canaries] restored stable @base-ui/utils to 0.3.2');
		}
	}

	const manifest = JSON.parse(readFileSync(canaryManifest, 'utf8'));

	if (manifest.version === '0.3.2-canary') {
		return false;
	}

	manifest.version = '0.3.2-canary';
	writeFileSync(canaryManifest, `${JSON.stringify(manifest, null, 2)}\n`);
	return true;
}

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

if (patchCanaryUtils(ROOT)) {
	patched += 1;
	console.log('[patch-canaries] canary @base-ui/utils -> 0.3.2-canary');
}

console.log(`[patch-canaries] done, ${patched} manifest(s) written`);
