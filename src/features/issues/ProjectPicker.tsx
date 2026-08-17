/**
 * The project field.
 *
 * Unlike the assignee and label pickers this is a `<Select>`, not a Combobox: the repository caps
 * projects at a few dozen (`datasetShape`), so there is nothing here to virtualize and a searchable
 * popup would be ceremony. It still reads through the paged, abortable contract — a picker that
 * got a synchronous array would stop testing anything (AGENTS.md — evaluation rule 3).
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useRepository } from '@/data';
import type { Page, Project, ProjectId } from '@/data';
import { Select } from '@/ds/select';
import type { SelectOption, SelectSize } from '@/ds/select';

const PAGE_SIZE = 25;

export interface ProjectPickerProps {
	value: ProjectId | null;
	onChange: (value: ProjectId | null) => void;
	/**
	 * The naming is the caller's job: wrapped in a `<Field>`, Base UI associates the label with the
	 * trigger itself, and inventing an `aria-label` here would override it with a worse one.
	 */
	id?: string;
	/** Shown when nothing is picked. "Any project" as a filter, "Select a project…" as a field. */
	placeholder?: string;
	size?: SelectSize;
	disabled?: boolean;
	className?: string;
}

export function ProjectPicker({
	value,
	onChange,
	id,
	placeholder = 'Select a project…',
	size,
	disabled,
	className,
}: ProjectPickerProps) {
	const repository = useRepository();

	const projects = useInfiniteQuery({
		queryKey: ['projects', 'list'],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.projects.list({ cursor: pageParam, limit: PAGE_SIZE, signal }),
		getNextPageParam: (lastPage: Page<Project>) => lastPage.nextCursor,
		staleTime: Infinity,
	});

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = projects;

	/*
	 * A `<Select>` shows every option at once, so the cursor is followed to the end rather than on
	 * scroll. That is only defensible because the count is bounded and known — the same loop over
	 * `issues.list` would be the client-side full scan this codebase refuses to do.
	 */
	useEffect(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// The value arrives as an id. Until the pages covering it have loaded, resolving it directly is
	// what keeps the trigger from reading "Select a project…" for an issue that plainly has one.
	const selected = useQuery({
		queryKey: ['projects', 'by-id', value],
		queryFn: ({ signal }) =>
			value === null
				? Promise.resolve<Project[]>([])
				: repository.projects.byIds([value], { signal }),
		enabled: value !== null,
		staleTime: Infinity,
	});

	const items = useMemo<Array<SelectOption<ProjectId>>>(() => {
		const loaded = (projects.data?.pages ?? []).flatMap((page) => page.items);
		const known = loaded.some((project) => project.id === value);
		const resolved = selected.data?.[0];
		const all = !known && resolved !== undefined ? [resolved, ...loaded] : loaded;

		const options = all.map((project) => ({
			value: project.id,
			label: `${project.key} · ${project.name}`,
		}));

		/*
		 * A set value that neither read has resolved yet — a failure under `?errorRate=`, most
		 * likely. Showing the placeholder here would say "no project" about an issue that has one, so
		 * the raw id stands in until a lookup succeeds.
		 */
		if (value !== null && !options.some((option) => option.value === value)) {
			options.unshift({ value, label: value });
		}

		return options;
	}, [projects.data, selected.data, value]);

	return (
		<Select<ProjectId>
			items={items}
			value={value}
			onValueChange={onChange}
			id={id}
			size={size}
			disabled={disabled}
			className={className}
			placeholder={projects.isPending ? 'Loading projects…' : placeholder}
		/>
	);
}
