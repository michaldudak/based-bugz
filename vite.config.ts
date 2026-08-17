import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
		// A single React instance is non-negotiable once three aliased Base UI builds
		// are installed side by side (AGENTS.md — Implementation switching).
		dedupe: ['react', 'react-dom'],
	},
	server: {
		host: true,
	},
});
