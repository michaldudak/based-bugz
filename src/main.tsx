import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/ds/global.css';

const container = document.getElementById('root');

if (!container) {
	throw new Error('Missing #root container in index.html');
}

// StrictMode stays on in development: double-mounting is how measurement-effect
// bugs surface early (AGENTS.md — evaluation rule 7).
createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
