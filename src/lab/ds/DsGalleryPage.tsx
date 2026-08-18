import { Page } from '@/ds/page';
import { ControlsGallery } from './ControlsGallery';
import { OverlaysGallery } from './OverlaysGallery';

/**
 * The design system gallery (AGENTS.md — Phase 2). Deliberately not Storybook:
 * one route, real components, checked in light/dark, both densities and RTL.
 *
 * Tooltip and Toast providers come from the app root — mounting them again here
 * would give the gallery its own toast viewport.
 */
export function DsGalleryPage() {
	return (
		<Page>
			<Page.Header>
				<Page.Title>Design system</Page.Title>
				<Page.Subtitle>
					Every wrapper in <code>src/ds</code>, in the states the app actually uses.
				</Page.Subtitle>
			</Page.Header>
			<ControlsGallery />
			<OverlaysGallery />
		</Page>
	);
}
