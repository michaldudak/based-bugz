import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRepository } from '@/data';
import type { VersionId } from '@/data';
import { VersionPicker } from '@/features/issues';
import styles from './StressPickers.module.css';

export interface StressVersionPickerProps {
	/** Marks the wrapper so a test can address the picker. */
	testId: string;
	label: string;
	/**
	 * Preselect the release at this position in the list (0 is the current release). The point is
	 * scroll-to-selected-on-open over rows that have never been mounted; positions past the end of
	 * the list fall back to the last row rather than pretending the case ran.
	 */
	preselectIndex?: number;
}

/**
 * The real `<VersionPicker>` feature over the real repository, so the case exercises whichever
 * implementation `?impl=` resolved. The version list is read through the same bulk endpoint the
 * feature uses — this wrapper only decides what is selected before you open the popup.
 */
export function StressVersionPicker({ testId, label, preselectIndex }: StressVersionPickerProps) {
	const repository = useRepository();
	const [value, setValue] = useState<VersionId | null>(null);
	const [preselectSettled, setPreselectSettled] = useState(preselectIndex === undefined);

	// The same query key the picker itself uses, so this costs no extra round-trip.
	const versions = useQuery({
		queryKey: ['versions', 'all'],
		queryFn: ({ signal }) => repository.versions.all({ signal }),
		staleTime: Infinity,
	});

	if (!preselectSettled && preselectIndex !== undefined && versions.data !== undefined) {
		const target =
			versions.data[Math.min(preselectIndex, versions.data.length - 1)] ??
			versions.data[versions.data.length - 1];

		setPreselectSettled(true);

		if (target !== undefined) {
			setValue(target.id);
		}
	}

	return (
		<div
			className={styles.picker}
			data-testid={testId}
			data-loaded={versions.data?.length ?? 0}
			data-preselected={value !== null ? 'true' : 'false'}
			data-preselect-settled={preselectSettled ? 'true' : 'false'}
		>
			<VersionPicker value={value} onChange={setValue} label={label} />
		</div>
	);
}
