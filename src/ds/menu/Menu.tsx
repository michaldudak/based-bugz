import type { ReactElement, ReactNode } from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import type {
	MenuCheckboxItemProps as BaseCheckboxItemProps,
	MenuItemProps as BaseItemProps,
	MenuPositionerProps as BasePositionerProps,
	MenuRadioGroupProps as BaseRadioGroupProps,
	MenuRootProps as BaseRootProps,
} from '@base-ui/react/menu';
import { IconCheck, IconChevronRight } from '@/ds/icons';
import { cx } from '@/ds/utils';
import styles from './Menu.module.css';

export type MenuSide = NonNullable<BasePositionerProps['side']>;
export type MenuAlign = NonNullable<BasePositionerProps['align']>;

/** Leading icon slot + label + trailing shortcut hint. Shared by every item flavour. */
function ItemBody({
	startIcon,
	shortcut,
	children,
}: {
	startIcon?: ReactNode;
	shortcut?: string;
	children?: ReactNode;
}) {
	return (
		<>
			<span className={styles.lead} aria-hidden={startIcon ? undefined : true}>
				{startIcon}
			</span>
			<span className={styles.label}>{children}</span>
			{shortcut ? <span className={styles.shortcut}>{shortcut}</span> : null}
		</>
	);
}

export interface MenuItemProps {
	startIcon?: ReactNode;
	/** Trailing keyboard hint, e.g. `⌘K`. Presentational only — bind the key yourself. */
	shortcut?: string;
	disabled?: boolean;
	closeOnClick?: boolean;
	onClick?: BaseItemProps['onClick'];
	/** Overrides the text used for typeahead when the label isn't a plain string. */
	label?: string;
	className?: string;
	children?: ReactNode;
}

export function MenuItem({
	startIcon,
	shortcut,
	disabled,
	closeOnClick,
	onClick,
	label,
	className,
	children,
}: MenuItemProps) {
	return (
		<BaseMenu.Item
			className={cx(styles.item, className)}
			disabled={disabled}
			closeOnClick={closeOnClick}
			onClick={onClick}
			label={label}
		>
			<ItemBody startIcon={startIcon} shortcut={shortcut}>
				{children}
			</ItemBody>
		</BaseMenu.Item>
	);
}

export interface MenuCheckboxItemProps {
	checked?: boolean;
	defaultChecked?: boolean;
	onCheckedChange?: BaseCheckboxItemProps['onCheckedChange'];
	shortcut?: string;
	disabled?: boolean;
	closeOnClick?: boolean;
	label?: string;
	className?: string;
	children?: ReactNode;
}

export function MenuCheckboxItem({
	checked,
	defaultChecked,
	onCheckedChange,
	shortcut,
	disabled,
	closeOnClick,
	label,
	className,
	children,
}: MenuCheckboxItemProps) {
	return (
		<BaseMenu.CheckboxItem
			className={cx(styles.item, className)}
			checked={checked}
			defaultChecked={defaultChecked}
			onCheckedChange={onCheckedChange}
			disabled={disabled}
			closeOnClick={closeOnClick}
			label={label}
		>
			<span className={styles.lead}>
				<BaseMenu.CheckboxItemIndicator className={styles.indicator}>
					<IconCheck size={14} />
				</BaseMenu.CheckboxItemIndicator>
			</span>
			<span className={styles.label}>{children}</span>
			{shortcut ? <span className={styles.shortcut}>{shortcut}</span> : null}
		</BaseMenu.CheckboxItem>
	);
}

export interface MenuRadioGroupProps {
	value?: BaseRadioGroupProps['value'];
	defaultValue?: BaseRadioGroupProps['defaultValue'];
	onValueChange?: BaseRadioGroupProps['onValueChange'];
	disabled?: boolean;
	/** Renders a `GroupLabel` inside the radio group, which is also its accessible name. */
	label?: ReactNode;
	className?: string;
	children?: ReactNode;
}

export function MenuRadioGroup({
	value,
	defaultValue,
	onValueChange,
	disabled,
	label,
	className,
	children,
}: MenuRadioGroupProps) {
	return (
		<BaseMenu.RadioGroup
			className={cx(styles.group, className)}
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			disabled={disabled}
		>
			{label ? (
				<BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>
			) : null}
			{children}
		</BaseMenu.RadioGroup>
	);
}

export interface MenuRadioItemProps {
	value: unknown;
	shortcut?: string;
	disabled?: boolean;
	closeOnClick?: boolean;
	label?: string;
	className?: string;
	children?: ReactNode;
}

export function MenuRadioItem({
	value,
	shortcut,
	disabled,
	closeOnClick,
	label,
	className,
	children,
}: MenuRadioItemProps) {
	return (
		<BaseMenu.RadioItem
			className={cx(styles.item, className)}
			value={value}
			disabled={disabled}
			closeOnClick={closeOnClick}
			label={label}
		>
			<span className={styles.lead}>
				<BaseMenu.RadioItemIndicator className={styles.indicator}>
					<span className={styles.dot} />
				</BaseMenu.RadioItemIndicator>
			</span>
			<span className={styles.label}>{children}</span>
			{shortcut ? <span className={styles.shortcut}>{shortcut}</span> : null}
		</BaseMenu.RadioItem>
	);
}

export interface MenuGroupProps {
	label?: ReactNode;
	className?: string;
	children?: ReactNode;
}

export function MenuGroup({ label, className, children }: MenuGroupProps) {
	return (
		<BaseMenu.Group className={cx(styles.group, className)}>
			{label ? (
				<BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>
			) : null}
			{children}
		</BaseMenu.Group>
	);
}

export interface MenuSeparatorProps {
	className?: string;
}

export function MenuSeparator({ className }: MenuSeparatorProps) {
	return <BaseMenu.Separator className={cx(styles.separator, className)} />;
}

export interface MenuSubmenuProps {
	/** Text of the parent item that opens the submenu. */
	label: ReactNode;
	startIcon?: ReactNode;
	disabled?: boolean;
	/** Typeahead text when `label` isn't a plain string. */
	textValue?: string;
	className?: string;
	children?: ReactNode;
}

/**
 * SubmenuRoot + SubmenuTrigger + Portal + Positioner + Popup. The parent item and the
 * nested popup are one component, because Base UI requires the trigger to live inside the
 * `SubmenuRoot` alongside the nested portal.
 */
export function MenuSubmenu({
	label,
	startIcon,
	disabled,
	textValue,
	className,
	children,
}: MenuSubmenuProps) {
	return (
		<BaseMenu.SubmenuRoot>
			<BaseMenu.SubmenuTrigger
				className={cx(styles.item, styles.submenuTrigger)}
				disabled={disabled}
				label={textValue}
			>
				<ItemBody startIcon={startIcon}>{label}</ItemBody>
				<IconChevronRight className={styles.submenuChevron} size={14} />
			</BaseMenu.SubmenuTrigger>
			<BaseMenu.Portal>
				<BaseMenu.Positioner
					className={styles.positioner}
					sideOffset={-4}
					alignOffset={-4}
					collisionPadding={12}
				>
					<BaseMenu.Popup className={cx(styles.popup, className)}>{children}</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.SubmenuRoot>
	);
}

export interface MenuProps {
	/**
	 * The element that opens the menu. Base UI needs the trigger inside `Menu.Root` next to
	 * the portal, so it cannot travel with the items as a child.
	 */
	trigger: ReactElement;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: BaseRootProps['onOpenChange'];
	modal?: boolean;
	disabled?: boolean;
	side?: MenuSide;
	align?: MenuAlign;
	sideOffset?: number;
	alignOffset?: number;
	/** Merged onto the popup surface. */
	className?: string;
	children?: ReactNode;
}

/**
 * Root + Portal + Positioner + Popup. Items stay explicit — collapsing them to an
 * `items={[]}` prop would throw away the API under evaluation (AGENTS.md — Design system
 * conventions).
 */
function MenuRoot({
	trigger,
	open,
	defaultOpen,
	onOpenChange,
	modal,
	disabled,
	side = 'bottom',
	align = 'start',
	sideOffset = 6,
	alignOffset = 0,
	className,
	children,
}: MenuProps) {
	return (
		<BaseMenu.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			modal={modal}
			disabled={disabled}
		>
			<BaseMenu.Trigger render={trigger} />
			<BaseMenu.Portal>
				<BaseMenu.Positioner
					className={styles.positioner}
					side={side}
					align={align}
					sideOffset={sideOffset}
					alignOffset={alignOffset}
					collisionPadding={12}
				>
					<BaseMenu.Popup className={cx(styles.popup, className)}>{children}</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.Root>
	);
}

export const Menu = Object.assign(MenuRoot, {
	Item: MenuItem,
	CheckboxItem: MenuCheckboxItem,
	RadioGroup: MenuRadioGroup,
	RadioItem: MenuRadioItem,
	Group: MenuGroup,
	Separator: MenuSeparator,
	Submenu: MenuSubmenu,
});
