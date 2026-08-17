import { ControlsGallery } from './ControlsGallery';
import { OverlaysGallery } from './OverlaysGallery';
import styles from './DsGalleryPage.module.css';

/**
 * The design system gallery (AGENTS.md — Phase 2). Deliberately not Storybook:
 * one route, real components, checked in light/dark, both densities and RTL.
 *
 * Tooltip and Toast providers come from the app root — mounting them again here
 * would give the gallery its own toast viewport.
 */
export function DsGalleryPage() {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Design system</h1>
				<p className={styles.subtitle}>
					Every wrapper in <code>src/ds</code>, in the states the app actually uses.
				</p>
			</header>
			<ControlsGallery />
			<OverlaysGallery />
		</div>
	);
}
