import { APP_NAME, APP_TAGLINE } from '@/app/config';
import styles from './App.module.css';

const PHASES = ['Phase 0 · toolchain', 'React 19', 'TypeScript 7', 'Vite 8', 'Base UI 1.7'];

export function App() {
	return (
		<main className={styles.root}>
			<div className={styles.card}>
				<h1 className={styles.title}>{APP_NAME}</h1>
				<p className={styles.tagline}>{APP_TAGLINE}</p>
				<ul className={styles.status}>
					{PHASES.map((phase) => (
						<li key={phase} className={styles.badge}>
							{phase}
						</li>
					))}
				</ul>
			</div>
		</main>
	);
}
