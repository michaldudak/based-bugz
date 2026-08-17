import type { CSSProperties, ReactNode, Ref } from 'react';
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import { cx } from '@/ds/utils';
import styles from './ScrollArea.module.css';

export interface ScrollAreaProps {
	children?: ReactNode;
	/** Which scrollbars to mount. Defaults to vertical only. */
	orientation?: 'vertical' | 'horizontal' | 'both';
	/**
	 * The scrolling element. A virtualizer needs this as its scroll container —
	 * `ScrollArea.Root` is not the thing that scrolls.
	 */
	viewportRef?: Ref<HTMLDivElement>;
	className?: string;
	style?: CSSProperties;
}

/**
 * Styled scrollbars over a native scroller.
 *
 * Deliberately thin: `ScrollArea.Content` is skipped, because it inserts a
 * `min-width: fit-content` wrapper between the viewport and its child, and a
 * virtualized list that absolutely positions rows inside a measured spacer must be
 * the viewport's direct child for its offsets to mean anything.
 */
export function ScrollArea({
	children,
	orientation = 'vertical',
	viewportRef,
	className,
	style,
}: ScrollAreaProps) {
	return (
		<BaseScrollArea.Root className={cx(styles.root, className)} style={style}>
			<BaseScrollArea.Viewport className={styles.viewport} ref={viewportRef}>
				{children}
			</BaseScrollArea.Viewport>
			{orientation !== 'horizontal' && (
				<BaseScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
					<BaseScrollArea.Thumb className={styles.thumb} />
				</BaseScrollArea.Scrollbar>
			)}
			{orientation !== 'vertical' && (
				<BaseScrollArea.Scrollbar className={styles.scrollbar} orientation="horizontal">
					<BaseScrollArea.Thumb className={styles.thumb} />
				</BaseScrollArea.Scrollbar>
			)}
			{orientation === 'both' && <BaseScrollArea.Corner className={styles.corner} />}
		</BaseScrollArea.Root>
	);
}
