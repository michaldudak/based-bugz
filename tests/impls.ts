import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The implementations the parity suite runs against.
 *
 * Read out of `src/app/impls.ts` rather than listed here, because a spec that hardcodes names is a
 * spec that silently stops covering the canary somebody registered this morning. The file cannot be
 * imported — it pulls in React and `@/ds/combobox` — so the registry literal is parsed instead. If
 * the shape of that file changes, this throws rather than quietly running against nothing.
 */
const REGISTRY_SOURCE = fileURLToPath(new URL('../src/app/impls.ts', import.meta.url));

export function readImplNames(): string[] {
	const source = readFileSync(REGISTRY_SOURCE, 'utf8');
	const start = source.indexOf('const IMPLS');
	const end = source.indexOf('export const IMPL_NAMES');

	if (start < 0 || end < 0 || end < start) {
		throw new Error(
			`Could not find the IMPLS registry in ${REGISTRY_SOURCE}. The parity suite discovers ` +
				'implementations by parsing it — update tests/impls.ts if that file was restructured.',
		);
	}

	const body = source.slice(start, end);
	const names = [...body.matchAll(/(?:^|[\n{])\s*'?([A-Za-z0-9_-]+)'?\s*:\s*lazy\(/g)].map(
		(match) => match[1] as string,
	);

	if (names.length === 0) {
		throw new Error(`No implementations found in ${REGISTRY_SOURCE}.`);
	}

	return names;
}
