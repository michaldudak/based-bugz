import { ToastProvider } from '@/ds/toast';
import { TooltipProvider } from '@/ds/tooltip';
import { ControlsGallery } from './ControlsGallery';
import { OverlaysGallery } from './OverlaysGallery';
import styles from './DsGalleryPage.module.css';

/**
 * The design system gallery (AGENTS.md — Phase 2). Deliberately not Storybook:
 * one route, real components, checked in light/dark, both densities and RTL.
 */
export function DsGalleryPage() {
	return (
		<TooltipProvider>
			<ToastProvider>
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
			</ToastProvider>
		</TooltipProvider>
	);
}
