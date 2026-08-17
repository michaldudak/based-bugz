import { defineConfig, devices } from '@playwright/test';
import type { ParityOptions } from './tests/fixtures';
import { readImplNames } from './tests/impls';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/*
 * The production preview, never the dev server. Dev numbers are worthless for comparison and dev
 * behaviour is not the shipped behaviour: StrictMode double-mounts, React runs its development
 * checks, and Vite serves unbundled modules (AGENTS.md — evaluation rule 7). `.claude/launch.json`
 * describes the same server for interactive use.
 */
export default defineConfig<ParityOptions>({
	testDir: './tests',
	fullyParallel: true,
	// No retries. A parity check that passes on the second attempt has told you nothing about
	// whether the implementation is reliable, which is the only thing it was asked.
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],

	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		...devices['Desktop Chrome'],
	},

	/*
	 * One project per implementation, discovered from the registry rather than listed here. The
	 * per-project results are the parity report: the same spec, the same assertions, one column per
	 * candidate API.
	 */
	projects: readImplNames().map((impl) => ({
		name: impl,
		use: { impl },
	})),

	webServer: {
		command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
		url: BASE_URL,
		// A preview server already running on 4173 is the one you were just looking at, and
		// rebuilding it under a test run would be a surprise.
		reuseExistingServer: true,
		timeout: 240_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
