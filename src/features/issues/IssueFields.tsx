/**
 * The five editable issue fields, shared by the create dialog and the detail header.
 *
 * They live together because "editable in place" and "fillable in a dialog" are the same control
 * with a different commit moment: the dialog holds a draft until submit, the detail page writes on
 * change. Splitting them would be two spellings of one status picker, and they would drift.
 */

import { useId } from 'react';
import type { ReactNode } from 'react';
import type { IssuePriority, IssueStatus, LabelId, ProjectId, UserId } from '@/data';
import { Field } from '@/ds/field';
import {
	IconCircle,
	IconCircleCheck,
	IconCircleHalf,
	IconCircleSlash,
	IconPencil,
} from '@/ds/icons';
import type { IconProps } from '@/ds/icons';
import { Select } from '@/ds/select';
import type { SelectOption, SelectSize } from '@/ds/select';
import { AssigneePicker } from './AssigneePicker';
import { LabelPicker } from './LabelPicker';
import { ProjectPicker } from './ProjectPicker';
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from './meta';
import type { AssigneeValue } from './useIssueFilters';
import styles from './IssueFields.module.css';

/** Workflow shape at a glance: empty, half, ticked, struck through. */
const STATUS_ICON: Record<IssueStatus, (props: IconProps) => ReactNode> = {
	backlog: IconCircle,
	todo: IconCircle,
	in_progress: IconCircleHalf,
	in_review: IconPencil,
	done: IconCircleCheck,
	cancelled: IconCircleSlash,
};

const STATUS_OPTIONS: Array<SelectOption<IssueStatus>> = STATUS_ORDER.map((status) => {
	const Glyph = STATUS_ICON[status];

	return { value: status, label: STATUS_LABEL[status], icon: <Glyph size={14} /> };
});

const PRIORITY_OPTIONS: Array<SelectOption<IssuePriority>> = PRIORITY_ORDER.map((priority) => ({
	value: priority,
	label: PRIORITY_LABEL[priority],
	icon: <span className={styles.priorityDot} data-priority={priority} />,
}));

/** The issue field is `UserId | null`; the picker's own value type spells "nobody" explicitly. */
export function assigneeValueOf(assigneeId: UserId | null): AssigneeValue {
	return assigneeId === null ? { kind: 'unassigned' } : { kind: 'user', id: assigneeId };
}

export function assigneeIdOf(value: AssigneeValue): UserId | null {
	return value?.kind === 'user' ? value.id : null;
}

/**
 * A visible `<label>` pointing at a Combobox input by id.
 *
 * The pickers are not Base UI `Field.Control`s, and a canary impl's Combobox will carry a
 * different React context than this app's stable `Field` — so `htmlFor` is the only association
 * that survives the package boundary (AGENTS.md — evaluation rule 2).
 */
function PickerField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
	const id = useId();

	return (
		<div className={styles.picker}>
			<label className={styles.pickerLabel} htmlFor={id}>
				{label}
			</label>
			{children(id)}
		</div>
	);
}

export interface StatusFieldProps {
	value: IssueStatus;
	onChange: (value: IssueStatus) => void;
	size?: SelectSize;
	disabled?: boolean;
}

export function StatusField({ value, onChange, size, disabled }: StatusFieldProps) {
	return (
		<Field label="Status" nativeLabel={false}>
			<Select<IssueStatus>
				items={STATUS_OPTIONS}
				value={value}
				// Base UI reports `null` for a cleared value; this control has no empty state, so a
				// null would mean "nothing changed" rather than "no status".
				onValueChange={(next) => next !== null && onChange(next)}
				size={size}
				disabled={disabled}
				className={styles.control}
			/>
		</Field>
	);
}

export interface PriorityFieldProps {
	value: IssuePriority;
	onChange: (value: IssuePriority) => void;
	size?: SelectSize;
	disabled?: boolean;
}

export function PriorityField({ value, onChange, size, disabled }: PriorityFieldProps) {
	return (
		<Field label="Priority" nativeLabel={false}>
			<Select<IssuePriority>
				items={PRIORITY_OPTIONS}
				value={value}
				onValueChange={(next) => next !== null && onChange(next)}
				size={size}
				disabled={disabled}
				className={styles.control}
			/>
		</Field>
	);
}

export interface ProjectFieldProps {
	value: ProjectId | null;
	onChange: (value: ProjectId | null) => void;
	size?: SelectSize;
	disabled?: boolean;
	error?: ReactNode;
}

export function ProjectField({ value, onChange, size, disabled, error }: ProjectFieldProps) {
	return (
		<Field label="Project" nativeLabel={false} error={error}>
			<ProjectPicker
				value={value}
				onChange={onChange}
				size={size}
				disabled={disabled}
				className={styles.control}
			/>
		</Field>
	);
}

export interface AssigneeFieldProps {
	value: UserId | null;
	onChange: (value: UserId | null) => void;
}

export function AssigneeField({ value, onChange }: AssigneeFieldProps) {
	return (
		<PickerField label="Assignee">
			{(id) => (
				<AssigneePicker
					id={id}
					label="Assignee"
					placeholder="Unassigned"
					value={assigneeValueOf(value)}
					onChange={(next) => onChange(assigneeIdOf(next))}
					// "Unassigned" is already a row in the list; a clear button would be a second
					// spelling of the same choice.
					clearable={false}
				/>
			)}
		</PickerField>
	);
}

export interface LabelsFieldProps {
	value: readonly LabelId[];
	onChange: (value: readonly LabelId[]) => void;
}

export function LabelsField({ value, onChange }: LabelsFieldProps) {
	return (
		<PickerField label="Labels">
			{(id) => (
				<LabelPicker
					id={id}
					label="Labels"
					placeholder="No labels"
					value={value}
					onChange={onChange}
				/>
			)}
		</PickerField>
	);
}
