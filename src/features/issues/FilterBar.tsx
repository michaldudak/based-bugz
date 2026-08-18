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
import { ProjectPicker } from './ProjectPicker';
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

interface ControlsProps {
	filters: IssueFiltersApi;
	stacked: boolean;
}

/**
 * The three pickers. Inline they are grid cells and size themselves from the track; stacked they
 * are full-width rows under their own labels.
 */
function FilterFields({ filters, stacked }: ControlsProps) {
	const assigneeId = useId();
	const labelId = useId();
	const projectId = useId();

	return (
		<>
			{stacked && (
				<label className={styles.fieldLabel} htmlFor={assigneeId}>
					Assignee
				</label>
			)}
			<AssigneePicker
				id={assigneeId}
				className={stacked ? styles.stackField : styles.field}
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
				className={stacked ? styles.stackField : styles.field}
				value={filters.labelIds}
				onChange={filters.setLabelIds}
			/>

			{/*
			 * The command palette can navigate here with `?project=`, so the filter needs a control:
			 * an active filter you cannot see is one you cannot turn off. The label is always
			 * rendered — `ds/select` has no way to take an accessible name of its own, so a visually
			 * hidden `<label>` is the only naming path when the bar is not stacked.
			 */}
			<label className={stacked ? styles.fieldLabel : styles.srOnly} htmlFor={projectId}>
				Project
			</label>
			<ProjectPicker
				id={projectId}
				className={stacked ? styles.stackField : styles.field}
				value={filters.projectId}
				onChange={filters.setProjectId}
				placeholder="Any project"
			/>
		</>
	);
}

/** The menu-shaped filters. Content-sized in both layouts. */
function FilterMenus({ filters, stacked }: ControlsProps) {
	return (
		<div className={stacked ? styles.stackRow : styles.menus}>
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
	);
}

export interface FilterBarProps {
	filters: IssueFiltersApi;
}

export function FilterBar({ filters }: FilterBarProps) {
	const compact = useMediaQuery(COMPACT_QUERY);
	const search = useDebouncedTextField(filters.text, filters.setText);

	const searchInput = (
		<Input
			type="search"
			value={search.value}
			onValueChange={search.onChange}
			placeholder="Search issues…"
			aria-label="Search issues"
			leadingIcon={<IconSearch size={14} />}
		/>
	);

	const end = (
		<div className={styles.end}>
			<SortMenu filters={filters} />
			{filters.isFiltered && (
				<Button variant="ghost" onClick={filters.clear}>
					Clear
				</Button>
			)}
		</div>
	);

	if (compact) {
		return (
			<div className={styles.compactBar}>
				<div className={styles.search}>{searchInput}</div>
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
					<div className={styles.stack}>
						<FilterFields filters={filters} stacked />
						<FilterMenus filters={filters} stacked />
					</div>
				</Popover>
				{end}
			</div>
		);
	}

	/*
	 * Two deliberate rows rather than one wrapping one. The fields used to be flex items with four
	 * different fixed widths, so where a row broke depended on the viewport: the last control on a
	 * line stopped wherever it happened to end, leaving a ragged edge against the list below.
	 */
	return (
		<div className={styles.bar}>
			<div className={styles.fields}>
				{searchInput}
				<FilterFields filters={filters} stacked={false} />
			</div>
			<div className={styles.menuRow}>
				<FilterMenus filters={filters} stacked={false} />
				{end}
			</div>
		</div>
	);
}
