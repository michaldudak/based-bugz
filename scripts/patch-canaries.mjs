/**
 * Post-install fix for the aliased canary build. Runs from the root `postinstall` hook, so a
 * plain `pnpm install` always leaves node_modules in the state the evaluation assumes.
 *
 * The canary declares the same package identity as stable `@base-ui/react`, and TypeScript
 * dedupes declaration files by `name@version` — without a split, the alias silently resolves to
 * stable's types and canary-only APIs "don't exist" (verified 2026-08-18, see PLAN.md Phase 9).
 * The suffix is derived from whatever version the canary declares, so a canary rebased onto a
 * newer stable keeps working. The canary's `@base-ui/utils` (see .pnpmfile.cjs) declares the
 * published version string too and gets the same treatment. Runtime never reads the field.
 */

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const CANARY_ALIAS = 'base-ui-5617';
const SUFFIX = '-pr5617';

function splitVersion(manifestPath, label) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

	if (manifest.version.endsWith(SUFFIX)) {
		return false;
	}

	manifest.version = `${manifest.version}${SUFFIX}`;
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	console.log(`[patch-canaries] ${label} -> ${manifest.version}`);
	return true;
}

function resolveUtilsManifest(fromDir) {
	try {
		const requireFrom = createRequire(join(realpathSync(fromDir), 'package.json'));
		return requireFrom.resolve('@base-ui/utils/package.json');
	} catch {
		return null;
	}
}

let patched = 0;
let canaryDir;

try {
	canaryDir = realpathSync(join(ROOT, 'node_modules', CANARY_ALIAS));
} catch {
	console.warn(`[patch-canaries] ${CANARY_ALIAS} is not installed - nothing to do`);
	process.exit(0);
}

if (splitVersion(join(canaryDir, 'package.json'), CANARY_ALIAS)) {
	patched += 1;
}

const stableUtils = resolveUtilsManifest(join(ROOT, 'node_modules', '@base-ui', 'react'));
const canaryUtils = resolveUtilsManifest(join(ROOT, 'node_modules', CANARY_ALIAS));

if (canaryUtils === null) {
	console.warn('[patch-canaries] could not resolve the canary @base-ui/utils - skipped');
} else if (canaryUtils === stableUtils) {
	throw new Error(
		'[patch-canaries] canary and stable resolve @base-ui/utils to the same instance — the ' +
			'.pnpmfile.cjs hook did not apply. Refusing to rename a shared manifest; run pnpm ' +
			'install again so the hook participates in resolution.',
	);
} else if (splitVersion(canaryUtils, `${CANARY_ALIAS} @base-ui/utils`)) {
	patched += 1;
}

console.log(`[patch-canaries] done, ${patched} manifest(s) written`);
