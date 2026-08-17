/**
 * The only place `InMemoryRepository` is constructed (AGENTS.md — Import rules). Everything above
 * this file sees the `Repository` interface and nothing else, which is what makes swapping in an
 * `HttpRepository` a one-file change.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createEventLog } from './event-log';
import { InMemoryRepository } from './in-memory';
import { parseDataParams } from './params';
import type { DataParams } from './params';
import {
	browserEventStorage,
	clearPersistedEvents,
	loadPersistedEvents,
	persistEventLog,
} from './persistence';
import type { EventStorage } from './persistence';
import type { Repository } from './repository';

const RepositoryContext = createContext<Repository | null>(null);

export interface RepositoryProviderProps {
	/** Defaults to the data params in `window.location.search`. */
	params?: DataParams;
	/** Pass `null` to run without persistence — useful for lab routes that must start clean. */
	storage?: EventStorage | null;
	children: ReactNode;
}

export function RepositoryProvider({ params, storage, children }: RepositoryProviderProps) {
	const resolved = useMemo(() => params ?? parseDataParams(), [params]);
	const { seed, scale, latency, errorRate, fresh } = resolved;

	// The log is keyed by (seed, scale) alone: changing `latency` or `errorRate` must not throw away
	// the edits you made while dogfooding.
	const log = useMemo(() => {
		const target = {
			seed,
			scale,
			storage: storage === undefined ? browserEventStorage() : storage,
		};

		if (fresh) {
			clearPersistedEvents(target);
		}

		return {
			target,
			log: createEventLog(fresh ? [] : loadPersistedEvents(target)),
		};
	}, [seed, scale, storage, fresh]);

	const repository = useMemo(
		() => new InMemoryRepository({ seed, scale, latency, errorRate, log: log.log }),
		[seed, scale, latency, errorRate, log],
	);

	useEffect(() => persistEventLog(log.log, log.target), [log]);

	return <RepositoryContext value={repository}>{children}</RepositoryContext>;
}

export function useRepository(): Repository {
	const repository = useContext(RepositoryContext);

	if (repository === null) {
		throw new Error(
			'useRepository() must be used inside <RepositoryProvider>. Wrap the tree in one — the ' +
				'repository is never constructed ad hoc, so there is no fallback.',
		);
	}

	return repository;
}
