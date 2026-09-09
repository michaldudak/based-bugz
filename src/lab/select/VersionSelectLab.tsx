import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useRepository } from '@/data';
import type { VersionId } from '@/data';
import { Page } from '@/ds/page';
import { useImplRegistry } from '@/ds/registry';
import { VersionPicker } from '@/features/issues';

/**
 * The Select surface for the pure-surroundings route (AGENTS.md — rule 12): the same real
 * `<VersionPicker>` the issue detail uses, so a Select bug can be reproduced with surroundings
 * from the picker's own package build before it is recorded against the PR.
 *
 * `?pick=` preselects the release at that index before the popup has ever opened — the state the
 * first-open scroll-to-selected finding needs (FINDINGS.md), which no amount of in-page clicking
 * can recreate once the popup has mounted once.
 */
export function VersionSelectLab() {
	const { activeName } = useImplRegistry();
	const repository = useRepository();
	const [searchParams] = useSearchParams();
	const [value, setValue] = useState<VersionId | null>(null);

	const rawPick = searchParams.get('pick');
	const pick = rawPick !== null && /^\d+$/.test(rawPick) ? Number(rawPick) : undefined;
	const [pickSettled, setPickSettled] = useState(pick === undefined);

	// The same query key the picker itself uses, so this costs no extra round-trip.
	const versions = useQuery({
		queryKey: ['versions', 'all'],
		queryFn: ({ signal }) => repository.versions.all({ signal }),
		staleTime: Infinity,
	});

	if (!pickSettled && pick !== undefined && versions.data !== undefined) {
		const target = versions.data[Math.min(pick, versions.data.length - 1)];

		setPickSettled(true);

		if (target !== undefined) {
			setValue(target.id);
		}
	}

	return (
		<Page.Section>
			<Page.SectionTitle>Version select</Page.SectionTitle>
			<Page.Description>
				The release list through the repository&rsquo;s bulk read, picked without a query box.
				Implementation: <code>{activeName}</code>.
			</Page.Description>
			<VersionPicker value={value} onChange={setValue} label="Affects version" />
		</Page.Section>
	);
}
