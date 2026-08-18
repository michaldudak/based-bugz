/**
 * The Based Bugz mark — the Base UI logo rotated 90 degrees counterclockwise,
 * which turns it into a snail: the half-disc becomes the shell, and the leaf
 * stretches out beneath it as the foot.
 *
 * The one mark of our own is the eye: a dot at (2.25, 10.25) r 1.25, pinned so
 * its left edge sits on x=1 (the nose tip, the body's leftmost point) and its
 * top on y=9 (the top of the body — the shell sits above, at y 0..8). Both
 * bounds already belong to the mark, so the eye costs no bounding box. It is the
 * largest radius that still clears the body's curve; the alignment forces the
 * centre to (1+r, 9+r), so a bigger dot walks diagonally into the body and
 * fuses with it at r ≈ 1.44.
 *
 * On screen, 90 degrees counterclockwise is SVG's `rotate(-90)` (the y axis
 * points down), so every point maps (x, y) -> (y, 17 - x). The coordinates below
 * are that map applied to Base UI's own path data and baked in, rather than left
 * as a live transform — verified pixel-identical to a
 * `translate(0 17) rotate(-90)` over the untouched original: max alpha delta
 * 7/255, on edge pixels only, i.e. antialiasing. Two exactly-collinear points,
 * artefacts of the original's stray `V12` commands, are dropped; same shape.
 *
 * The viewBox is tightened to the ink (x 1..23, y 0..17) so `size` means the
 * mark's real height and call sites control spacing with CSS rather than
 * fighting built-in padding.
 *
 * Inline SVG and `currentColor`, like `ds/icons` — no icon dependency and no
 * remote asset (AGENTS.md — Conventions). It lives in `app/` rather than `ds/`
 * because a brand mark is the one thing in the app that is not generic.
 */
import type { SVGProps } from 'react';

const WIDTH = 22;
const HEIGHT = 17;

export type LogoProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
	/** Rendered height in px. Width follows the mark's aspect ratio. */
	size?: number;
};

export function Logo({ size = 16, ...props }: LogoProps) {
	return (
		<svg
			width={(size * WIDTH) / HEIGHT}
			height={size}
			viewBox={`1 0 ${WIDTH} ${HEIGHT}`}
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
			{...props}
		>
			<path d="M7.0154 7.4999C6.9984 7.7755 7.2238 8 7.5 8L23 8C23 3.5817 19.4183 0 15 0C10.7497 0 7.2735 3.3146 7.0154 7.4999Z" />
			<path d="M9.8 9L23 9C23 13.4183 19.0601 17 14.2 17L1 17C1 12.5817 4.9399 9 9.8 9Z" />
			<circle cx="2.25" cy="10.25" r="1.25" />
		</svg>
	);
}
