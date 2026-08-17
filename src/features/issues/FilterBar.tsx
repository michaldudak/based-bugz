/**
 * The filter bar.
 *
 * Below 768px the controls move into a "Filters" popover rather than overflowing (AGENTS.md —
 * Appearance). The branch is in JS, not CSS: rendering both copies would mount two of every
 * combobox, each paging the same 5,000 users, and duplicate every control id.
 */

import { useId } from 'react';
import { DEFAULT_ISSUE_SORT } from '@/data';
import { Button } from '@/ds/button';
import { IconChevronDown, IconFilter, IconSearch, IconSort } from '@/ds/icons';
import { Input } from '@/ds/input';
import { Menu } from '@/ds/menu';
import { Popover } from '@/ds/popover';
import { AssigneePicker } from './AssigneePicker';
import { LabelPicker } from './LabelPicker';
import { useDebouncedTextField, useMediaQuery } from './hooks';
import {
	PRIORITY_LABEL,
	PRIORITY_ORDER,
	SORT_DIRECTIONS,
	SORT_DIRECTION_LABEL,
	SORT_FIELDS,
	SORT_FIELD_LABEL,
	STATUS_LABEL,
	STATUS_ORDER,
	parseSort,
} from './meta';
import type { IssueFiltersApi } from './useIssueFilters';
import styles from './FilterBar.module.css';

const COMPACT_QUERY = '(max-width: 768px)';

interface CheckboxMenuProps<T extends string> {
	name: string;
	options: readonly T[];
	value: readonly T[];
	labelOf: Record<T, string>;
	onChange: (value: readonly T[]) => void;
}

/**
 * Multi-select as a menu of checkbox items. `closeOnClick={false}` is the whole reason this is a
 * menu and not a `<Select>`: picking three statuses should cost three clicks, not three reopens.
 */
function CheckboxMenu<T extends string>({
	name,
	options,
	value,
	labelOf,
	onChange,
}: CheckboxMenuProps<T>) {
	const only = value.length === 1 ? value[0] : undefined;
	const summary =
		only !== undefined ? labelOf[only] : value.length === 0 ? name : `${name}: ${value.length}`;

	return (
		<Menu
			trigger={
				<Button className={styles.trigger} data-active={value.length > 0 || undefined}>
					<span className={styles.triggerLabel}>{summary}</span>
					<IconChevronDown size={14} />
				</Button>
			}
		>
			{options.map((option) => (
				<Menu.CheckboxItem
					key={option}
					closeOnClick={false}
					checked={value.includes(option)}
					onCheckedChange={(checked) =>
						onChange(checked ? [...value, option] : value.filter((current) => current !== option))
					}
				>
					{labelOf[option]}
				</Menu.CheckboxItem>
			))}
			{value.length > 0 && (
				<>
					<Menu.Separator />
					<Menu.Item onClick={() => onChange([])}>Clear {name.toLowerCase()}</Menu.Item>
				</>
			)}
		</Menu>
	);
}

function SortMenu({ filters }: { filters: IssueFiltersApi }) {
	const { sort, setSort } = filters;

	return (
		<Menu
			align="end"
			trigger={
				<Button className={styles.trigger} aria-label={`Sort: ${SORT_FIELD_LABEL[sort.field]}`}>
					<IconSort size={14} />
					<span className={styles.triggerLabel}>{SORT_FIELD_LABEL[sort.field]}</span>
					<IconChevronDown size={14} />
				</Button>
			}
		>
			<Menu.RadioGroup
				label="Sort by"
				value={sort.field}
				onValueChange={(field) =>
					setSort(parseSort(`${String(field)}-${sort.direction}`) ?? DEFAULT_ISSUE_SORT)
				}
			>
				{SORT_FIELDS.map((field) => (
					<Menu.RadioItem key={field} value={field} closeOnClick={false}>
						{SORT_FIELD_LABEL[field]}
					</Menu.RadioItem>
				))}
			</Menu.RadioGroup>
			<Menu.Separator />
			<Menu.RadioGroup
				label="Direction"
				value={sort.direction}
				onValueChange={(direction) =>
					setSort(parseSort(`${sort.field}-${String(direction)}`) ?? DEFAULT_ISSUE_SORT)
				}
			>
				{SORT_DIRECTIONS.map((direction) => (
					<Menu.RadioItem key={direction} value={direction} closeOnClick={false}>
						{SORT_DIRECTION_LABEL[direction]}
					</Menu.RadioItem>
				))}
			</Menu.RadioGroup>
		</Menu>
	);
}

function LabelMatchMenu({ filters }: { filters: IssueFiltersApi }) {
	return (
		<Menu
			trigger={
				<Button className={styles.trigger}>
					<span className={styles.triggerLabel}>
						{filters.labelMatch === 'all' ? 'All labels' : 'Any label'}
					</span>
					<IconChevronDown size={14} />
				</Button>
			}
		>
			<Menu.RadioGroup
				label="Match"
				value={filters.labelMatch}
				onValueChange={(next) => filters.setLabelMatch(next === 'all' ? 'all' : 'any')}
			>
				<Menu.RadioItem value="any">Any of the labels</Menu.RadioItem>
				<Menu.RadioItem value="all">All of the labels</Menu.RadioItem>
			</Menu.RadioGroup>
		</Menu>
	);
}

/** The controls that collapse. Rendered inline on a wide viewport, in a popover on a narrow one. */
function FilterControls({ filters, stacked }: { filters: IssueFiltersApi; stacked: boolean }) {
	const assigneeId = useId();
	const labelId = useId();

	return (
		<div className={stacked ? styles.stack : styles.inline}>
			{stacked && (
				<label className={styles.fieldLabel} htmlFor={assigneeId}>
					Assignee
				</label>
			)}
			<AssigneePicker
				id={assigneeId}
				className={stacked ? styles.stackField : styles.assignee}
				value={filters.assignee}
				onChange={filters.setAssignee}
			/>

			{stacked && (
				<label className={styles.fieldLabel} htmlFor={labelId}>
					Labels
				</label>
			)}
			<LabelPicker
				id={labelId}
				className={stacked ? styles.stackField : styles.labels}
				value={filters.labelIds}
				onChange={filters.setLabelIds}
			/>

			<div className={stacked ? styles.stackRow : styles.contents}>
				<CheckboxMenu
					name="Status"
					options={STATUS_ORDER}
					labelOf={STATUS_LABEL}
					value={filters.statuses}
					onChange={filters.setStatuses}
				/>
				<CheckboxMenu
					name="Priority"
					options={PRIORITY_ORDER}
					labelOf={PRIORITY_LABEL}
					value={filters.priorities}
					onChange={filters.setPriorities}
				/>
				{filters.labelIds.length > 1 && <LabelMatchMenu filters={filters} />}
			</div>
		</div>
	);
}

export interface FilterBarProps {
	filters: IssueFiltersApi;
}

export function FilterBar({ filters }: FilterBarProps) {
	const compact = useMediaQuery(COMPACT_QUERY);
	const search = useDebouncedTextField(filters.text, filters.setText);

	return (
		<div className={styles.bar}>
			<Input
				className={styles.search}
				type="search"
				value={search.value}
				onValueChange={search.onChange}
				placeholder="Search issues…"
				aria-label="Search issues"
				leadingIcon={<IconSearch size={14} />}
			/>

			{compact ? (
				<Popover
					align="start"
					className={styles.filterPopup}
					trigger={
						<Button data-active={filters.activeCount > 0 || undefined}>
							<IconFilter size={14} />
							Filters
							{filters.activeCount > 0 && (
								<span className={styles.badge}>{filters.activeCount}</span>
							)}
						</Button>
					}
				>
					<FilterControls filters={filters} stacked />
				</Popover>
			) : (
				<FilterControls filters={filters} stacked={false} />
			)}

			<div className={styles.end}>
				<SortMenu filters={filters} />
				{filters.isFiltered && (
					<Button variant="ghost" onClick={filters.clear}>
						Clear
					</Button>
				)}
			</div>
		</div>
	);
}
