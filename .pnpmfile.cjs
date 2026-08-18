/**
 * Points the canary Base UI builds at the canary `@base-ui/utils`.
 *
 * The canaries import utils subpaths (`clamp`, `areArraysEqual`, …) that the published 0.3.2 does
 * not ship — pkg.pr.new publishes `@base-ui/react` per PR but its manifest still pins the released
 * utils. A plain override cannot fix this: during resolution the canaries are indistinguishable
 * from stable by name and version (`@base-ui/react@1.7.0`), so any name-scoped override would drag
 * stable along. What does distinguish them is the dependency the virtualization PRs added, so the
 * hook keys on that.
 *
 * One URL for all three: the three PRs' utils tarballs are byte-identical (verified 2026-08-18,
 * sha256 35f21b20…). The version identity split happens post-install in scripts/patch-canaries.mjs.
 */

'use strict';

const CANARY_MARKER = '@mui/x-virtualizer';
const CANARY_UTILS =
	'https://pkg.pr.new/mui/base-ui/@base-ui/utils@a873cbc2d3f99952072069fe29e6511a66a398e9';

function readPackage(pkg) {
	if (pkg.name === '@base-ui/react' && pkg.dependencies && pkg.dependencies[CANARY_MARKER]) {
		pkg.dependencies['@base-ui/utils'] = CANARY_UTILS;
	}

	return pkg;
}

module.exports = { hooks: { readPackage } };
