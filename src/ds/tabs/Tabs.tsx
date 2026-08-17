import type { CSSProperties, ReactNode } from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type {
	TabsListProps as BaseTabsListProps,
	TabsPanelProps as BaseTabsPanelProps,
	TabsRootProps as BaseTabsRootProps,
	TabsTabProps as BaseTabsTabProps,
} from '@base-ui/react/tabs';
import { cx } from '@/ds/utils';
import styles from './Tabs.module.css';

type Styleable = { className?: string; style?: CSSProperties };

export interface TabsProps
	extends Omit<BaseTabsRootProps, 'className' | 'style' | 'render'>, Styleable {}

export interface TabsListProps
	extends Omit<BaseTabsListProps, 'className' | 'style' | 'render'>, Styleable {
	children?: ReactNode;
}

export interface TabsTabProps
	extends Omit<BaseTabsTabProps, 'className' | 'style' | 'render'>, Styleable {}

export interface TabsPanelProps
	extends Omit<BaseTabsPanelProps, 'className' | 'style' | 'render'>, Styleable {}

function TabsRoot({ className, ...props }: TabsProps) {
	return <BaseTabs.Root className={cx(styles.root, className)} {...props} />;
}

/** The active indicator is part of the list, not something a call site remembers to add. */
function TabsList({ className, children, ...props }: TabsListProps) {
	return (
		<BaseTabs.List className={cx(styles.list, className)} {...props}>
			{children}
			<BaseTabs.Indicator className={styles.indicator} />
		</BaseTabs.List>
	);
}

function TabsTab({ className, ...props }: TabsTabProps) {
	return <BaseTabs.Tab className={cx(styles.tab, className)} {...props} />;
}

function TabsPanel({ className, ...props }: TabsPanelProps) {
	return <BaseTabs.Panel className={cx(styles.panel, className)} {...props} />;
}

export const Tabs = Object.assign(TabsRoot, {
	List: TabsList,
	Tab: TabsTab,
	Panel: TabsPanel,
});
