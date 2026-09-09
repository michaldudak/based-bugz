/**
 * The affects-version field.
 *
 * A `<Select>`, not a Combobox: there is no query box on a version field — you pick the release
 * you were running, usually a recent one, sometimes by typing the first digits and letting
 * typeahead land there. Unlike the project picker's few dozen rows, the release list scales with
 * the dataset (`datasetShape`: 1,250 versions at the default 10k issues), which is exactly why
 * this field goes through the implementation seam.
 *
 * The list arrives in one bulk read (`versions.all()`), the repository's second deliberate bulk
 * endpoint — still async, abortable and failure-injected (AGENTS.md — evaluation rule 3). Real
 * apps serve version vocabularies exactly this way.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useRepository } from '@/data';
import type { Version, VersionId } from '@/data';
import { Select } from '@/ds/select';
import type { SelectSize } from '@/ds/select';
import { formatRelativeTime } from './meta';
import styles from './VersionPicker.module.css';

/** Single-line rows at the default density (`--row-h`). Measurement corrects the rest. */
const ROW_ESTIMATE = 36;

const versionKey = (version: Version) => version.id;
const versionLabel = (version: Version) => version.name;
// Module-scope for identity: the chosen engine materializes per-item estimates over the whole
// collection whenever the callback identity changes (FINDINGS.md — callbacks consumed eagerly).
const estimateRow = () => ROW_ESTIMATE;

function VersionRow({ version }: { version: Version }) {
	return (
		<>
			<span className={styles.name}>{version.name}</span>
			<span className={styles.meta}>{formatRelativeTime(version.releasedAt)}</span>
		</>
	);
}

const renderVersion = (version: Version) => <VersionRow version={version} />;

export interface VersionPickerProps {
	value: VersionId | null;
	onChange: (value: VersionId | null) => void;
	/** The naming is the caller's job — a visible `<label htmlFor>` reaches the trigger by id. */
	id?: string;
	label?: string;
	placeholder?: string;
	size?: SelectSize;
	disabled?: boolean;
	className?: string;
}

export function VersionPicker({
	value,
	onChange,
	id,
	label,
	placeholder = 'No version',
	size,
	disabled,
	className,
}: VersionPickerProps) {
	const repository = useRepository();

	const versions = useQuery({
		queryKey: ['versions', 'all'],
		queryFn: ({ signal }) => repository.versions.all({ signal }),
		staleTime: Infinity,
	});

	/*
	 * The value arrives as an id; the contract wants the item. A set id the loaded list cannot
	 * resolve — a failure under `?errorRate=`, or a stale log reference — stands in as a bare
	 * row rather than reading "No version" about an issue that has one.
	 */
	const { items, selected } = useMemo(() => {
		const loaded = versions.data ?? [];
		const known = value === null ? undefined : loaded.find((version) => version.id === value);

		if (value !== null && known === undefined) {
			const stub: Version = { id: value, name: value, releasedAt: 0 };
			return { items: [stub, ...loaded], selected: stub };
		}

		return { items: loaded, selected: known ?? null };
	}, [versions.data, value]);

	return (
		<Select<Version>
			items={items}
			itemKey={versionKey}
			itemLabel={versionLabel}
			value={selected}
			onValueChange={(next) => onChange(next === null ? null : next.id)}
			renderItem={renderVersion}
			renderValue={versionLabel}
			estimateItemHeight={estimateRow}
			placeholder={versions.isPending ? 'Loading versions…' : placeholder}
			disabled={disabled}
			id={id}
			label={label}
			size={size}
			className={className}
		/>
	);
}
