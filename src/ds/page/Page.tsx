import type { ReactNode } from 'react';
import { cx } from '@/ds/utils';
import styles from './Page.module.css';

export type PageWidth = 'contained' | 'full';

export interface PageProps {
	/**
	 * `contained` centres the page on `--page-max`; `full` spans the whole content area, for
	 * screens whose own child wants every pixel of it.
	 */
	width?: PageWidth;
	/**
	 * Make the page exactly as tall as the shell's content area so a child can own its own scroll
	 * container. Without it the page grows and the document scrolls.
	 */
	fill?: boolean;
	className?: string;
	children?: ReactNode;
}

/**
 * The page frame every route renders into.
 *
 * It exists because width and heading sizes are the two things that drift the moment each screen
 * owns its own CSS module: four routes, four max-widths, two different `<h1>` sizes. Routes now
 * pick from two widths and take the rest.
 */
function PageRoot({ width = 'contained', fill = false, className, children }: PageProps) {
	return (
		<div
			className={cx(
				styles.page,
				width === 'contained' && styles.contained,
				fill ? styles.fill : styles.scrolls,
				className,
			)}
		>
			{children}
		</div>
	);
}

export interface PageHeaderProps {
	/** Trailing controls, laid out opposite the heading and wrapping under it when narrow. */
	actions?: ReactNode;
	className?: string;
	children?: ReactNode;
}

/** Title, subtitle and anything else that introduces the page, plus an `actions` slot. */
export function PageHeader({ actions, className, children }: PageHeaderProps) {
	return (
		<header className={cx(styles.header, className)}>
			<div className={styles.heading}>{children}</div>
			{actions !== undefined && <div className={styles.actions}>{actions}</div>}
		</header>
	);
}

export interface PageTextProps {
	className?: string;
	children?: ReactNode;
}

/** The page's `<h1>`. One per route. */
export function PageTitle({ className, children }: PageTextProps) {
	return <h1 className={cx(styles.title, className)}>{children}</h1>;
}

/** The lede under the title. */
export function PageSubtitle({ className, children }: PageTextProps) {
	return <p className={cx(styles.subtitle, className)}>{children}</p>;
}

/** A muted paragraph, for the note that belongs under a heading at any level. */
export function PageDescription({ className, children }: PageTextProps) {
	return <p className={cx(styles.description, className)}>{children}</p>;
}

export interface PageSectionProps {
	className?: string;
	children?: ReactNode;
}

/** A top-level block of the page. Pair with `Page.SectionTitle`. */
export function PageSection({ className, children }: PageSectionProps) {
	return <section className={cx(styles.section, className)}>{children}</section>;
}

export function PageSectionTitle({ className, children }: PageTextProps) {
	return <h2 className={cx(styles.sectionTitle, className)}>{children}</h2>;
}

/** A block nested inside a section. Pair with `Page.SubsectionTitle`. */
export function PageSubsection({ className, children }: PageSectionProps) {
	return <section className={cx(styles.subsection, className)}>{children}</section>;
}

export function PageSubsectionTitle({ className, children }: PageTextProps) {
	return <h3 className={cx(styles.subsectionTitle, className)}>{children}</h3>;
}

export const Page = Object.assign(PageRoot, {
	Header: PageHeader,
	Title: PageTitle,
	Subtitle: PageSubtitle,
	Description: PageDescription,
	Section: PageSection,
	SectionTitle: PageSectionTitle,
	Subsection: PageSubsection,
	SubsectionTitle: PageSubsectionTitle,
});
