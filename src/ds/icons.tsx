/**
 * Inline SVG icons. No icon dependency and no remote assets, so the app makes
 * zero runtime network requests (AGENTS.md — Conventions).
 *
 * All icons are 16x16, stroke-based, and inherit `currentColor`.
 */
import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{...props}
		>
			{children}
		</svg>
	);
}

export const IconCheck = (p: IconProps) => (
	<Icon {...p}>
		<path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
	</Icon>
);

export const IconChevronDown = (p: IconProps) => (
	<Icon {...p}>
		<path d="M4 6.25 8 10.25 12 6.25" />
	</Icon>
);

export const IconChevronUp = (p: IconProps) => (
	<Icon {...p}>
		<path d="M4 9.75 8 5.75 12 9.75" />
	</Icon>
);

export const IconChevronRight = (p: IconProps) => (
	<Icon {...p}>
		<path d="M6.25 4 10.25 8 6.25 12" />
	</Icon>
);

export const IconChevronLeft = (p: IconProps) => (
	<Icon {...p}>
		<path d="M9.75 4 5.75 8 9.75 12" />
	</Icon>
);

export const IconClose = (p: IconProps) => (
	<Icon {...p}>
		<path d="M4 4 12 12M12 4 4 12" />
	</Icon>
);

export const IconSearch = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="7" cy="7" r="4" />
		<path d="M10.2 10.2 13.5 13.5" />
	</Icon>
);

export const IconPlus = (p: IconProps) => (
	<Icon {...p}>
		<path d="M8 3.5v9M3.5 8h9" />
	</Icon>
);

export const IconTrash = (p: IconProps) => (
	<Icon {...p}>
		<path d="M2.75 4.5h10.5M6.5 4.5V3h3v1.5M4.5 4.5 5 13h6l.5-8.5" />
	</Icon>
);

export const IconPencil = (p: IconProps) => (
	<Icon {...p}>
		<path d="M10.75 2.75 13.25 5.25 5.75 12.75 2.75 13.25 3.25 10.25z" />
	</Icon>
);

export const IconUser = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="5.75" r="2.75" />
		<path d="M2.75 13.25c0-2.5 2.35-3.75 5.25-3.75s5.25 1.25 5.25 3.75" />
	</Icon>
);

export const IconTag = (p: IconProps) => (
	<Icon {...p}>
		<path d="M8.5 2.5h5v5l-6 6-5-5z" />
		<circle cx="10.75" cy="5.25" r="0.9" />
	</Icon>
);

export const IconFilter = (p: IconProps) => (
	<Icon {...p}>
		<path d="M2.5 3.75h11L9.25 8.5v4.25l-2.5-1.5V8.5z" />
	</Icon>
);

export const IconSort = (p: IconProps) => (
	<Icon {...p}>
		<path d="M4.5 12.5v-9M2.25 5.75 4.5 3.5l2.25 2.25M11.5 3.5v9M9.25 10.25l2.25 2.25 2.25-2.25" />
	</Icon>
);

export const IconMore = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
		<circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
		<circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
	</Icon>
);

export const IconMenu = (p: IconProps) => (
	<Icon {...p}>
		<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
	</Icon>
);

export const IconSun = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="3" />
		<path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" />
	</Icon>
);

export const IconMoon = (p: IconProps) => (
	<Icon {...p}>
		<path d="M13.25 9.6A5.75 5.75 0 0 1 6.4 2.75a5.75 5.75 0 1 0 6.85 6.85z" />
	</Icon>
);

export const IconMonitor = (p: IconProps) => (
	<Icon {...p}>
		<rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" />
		<path d="M5.5 14h5M8 11.25V14" />
	</Icon>
);

export const IconSettings = (p: IconProps) => (
	<Icon {...p}>
		<path d="M2.5 4.5h3M8.5 4.5h5M2.5 11.5h5M10.5 11.5h3" />
		<circle cx="7" cy="4.5" r="1.5" />
		<circle cx="9" cy="11.5" r="1.5" />
	</Icon>
);

export const IconLogout = (p: IconProps) => (
	<Icon {...p}>
		<path d="M9.5 2.75H12.5a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75H9.5M8.5 8h-6M5 5.5 2.5 8 5 10.5" />
	</Icon>
);

export const IconWarning = (p: IconProps) => (
	<Icon {...p}>
		<path d="M8 2.25 14.75 13.5H1.25z" />
		<path d="M8 6.5v3" />
		<circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
	</Icon>
);

export const IconInfo = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="6" />
		<path d="M8 7.25v4" />
		<circle cx="8" cy="5" r="0.75" fill="currentColor" stroke="none" />
	</Icon>
);

export const IconCircle = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="5.25" />
	</Icon>
);

export const IconCircleHalf = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="5.25" />
		<path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor" stroke="none" />
	</Icon>
);

export const IconCircleCheck = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="5.25" />
		<path d="M5.5 8.25 7.25 10 10.5 6.25" />
	</Icon>
);

export const IconCircleSlash = (p: IconProps) => (
	<Icon {...p}>
		<circle cx="8" cy="8" r="5.25" />
		<path d="M4.5 11.5 11.5 4.5" />
	</Icon>
);

export const IconInbox = (p: IconProps) => (
	<Icon {...p}>
		<path d="M2 9.5h3l1 2h4l1-2h3" />
		<path d="M2.75 9.5 4 3.5h8l1.25 6v3a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75z" />
	</Icon>
);
