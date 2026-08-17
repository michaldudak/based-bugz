import type { CSSProperties, ReactNode } from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import type { SelectRootChangeEventDetails } from '@base-ui/react/select';
import { IconCheck, IconChevronDown } from '@/ds/icons';
import { cx } from '@/ds/utils';
import styles from './Select.module.css';

export type SelectSize = 'sm' | 'md';

export interface SelectOption<Value> {
	value: Value;
	label: ReactNode;
	/** Optional glyph shown in the list and echoed in the trigger when selected. */
	icon?: ReactNode;
	disabled?: boolean;
}

export interface SelectProps<Value> {
	items: ReadonlyArray<SelectOption<Value>>;
	value?: Value | null;
	defaultValue?: Value | null;
	onValueChange?: (value: Value | null, eventDetails: SelectRootChangeEventDetails) => void;
	placeholder?: ReactNode;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean, eventDetails: SelectRootChangeEventDetails) => void;
	disabled?: boolean;
	readOnly?: boolean;
	required?: boolean;
	name?: string;
	id?: string;
	size?: SelectSize;
	className?: string;
	style?: CSSProperties;
}

/**
 * Single-value select. Portal, Positioner, Popup and List are assembled here; the
 * caller supplies data, not structure.
 *
 * `alignItemWithTrigger` is off: the aligned mode overlays the popup on the trigger,
 * which on a small viewport puts the list under a thumb that is already covering it.
 * The popup is also opacity-only on enter — nothing that contains a list may
 * scale-animate (AGENTS.md — Appearance).
 */
export function Select<Value>({
	items,
	placeholder = 'Select…',
	size = 'md',
	className,
	style,
	...props
}: SelectProps<Value>) {
	return (
		<BaseSelect.Root<Value> {...props}>
			<BaseSelect.Trigger
				className={cx(styles.trigger, size === 'sm' && styles.sm, className)}
				style={style}
			>
				<BaseSelect.Value className={styles.value}>
					{(current: Value | null) => {
						const item = items.find((candidate) => Object.is(candidate.value, current));

						if (!item) {
							return placeholder;
						}

						return (
							<>
								{item.icon != null && <span className={styles.icon}>{item.icon}</span>}
								<span className={styles.text}>{item.label}</span>
							</>
						);
					}}
				</BaseSelect.Value>
				<BaseSelect.Icon className={styles.chevron}>
					<IconChevronDown size={14} />
				</BaseSelect.Icon>
			</BaseSelect.Trigger>
			<BaseSelect.Portal>
				<BaseSelect.Positioner
					className={styles.positioner}
					sideOffset={4}
					align="start"
					alignItemWithTrigger={false}
				>
					<BaseSelect.Popup className={styles.popup}>
						<BaseSelect.List className={styles.list}>
							{items.map((item, index) => (
								// Values may be objects, so position is the only always-safe key.
								// Items hold no local state, so reordering costs nothing.
								<BaseSelect.Item
									key={index}
									value={item.value}
									disabled={item.disabled}
									className={styles.item}
								>
									<BaseSelect.ItemIndicator className={styles.indicator}>
										<IconCheck size={14} />
									</BaseSelect.ItemIndicator>
									<BaseSelect.ItemText className={styles.itemText}>
										{item.icon != null && <span className={styles.icon}>{item.icon}</span>}
										{item.label}
									</BaseSelect.ItemText>
								</BaseSelect.Item>
							))}
						</BaseSelect.List>
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}
