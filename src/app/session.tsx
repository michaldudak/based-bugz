/**
 * Fake authentication. There is no password check — any password is accepted for an email that
 * belongs to a seeded user. The point is not security but that a signed-in user exists: it drives
 * "assigned to me", comment authorship and activity attribution.
 */

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isAbortError, parseDataParams, useRepository } from '@/data';
import type { User } from '@/data';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

interface SessionContextValue {
	status: SessionStatus;
	user: User | null;
	signIn: (email: string) => Promise<User>;
	signInAsRandomUser: () => Promise<User>;
	signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Keyed by seed: a session from one dataset must not point at a user another dataset lacks. */
function storageKey(): string {
	return `bugz:session:${parseDataParams().seed}`;
}

function readStoredUserId(): string | null {
	try {
		return window.localStorage.getItem(storageKey());
	} catch {
		return null;
	}
}

function writeStoredUserId(id: string | null): void {
	try {
		if (id === null) {
			window.localStorage.removeItem(storageKey());
		} else {
			window.localStorage.setItem(storageKey(), id);
		}
	} catch {
		// Private browsing or a full quota. A session that doesn't survive reload is degraded,
		// not broken, so this is deliberately swallowed.
	}
}

export function SessionProvider({ children }: { children: ReactNode }) {
	const repository = useRepository();
	const [user, setUser] = useState<User | null>(null);
	const [status, setStatus] = useState<SessionStatus>('loading');

	// Restore a persisted session once per repository instance.
	useEffect(() => {
		const storedId = readStoredUserId();

		if (storedId === null) {
			setStatus('signed-out');
			return;
		}

		const controller = new AbortController();

		repository.users
			.byIds([storedId], { signal: controller.signal })
			.then((users) => {
				const restored = users[0] ?? null;

				// The stored id can outlive its dataset when `scale` shrinks.
				if (restored === null) {
					writeStoredUserId(null);
				}

				setUser(restored);
				setStatus(restored === null ? 'signed-out' : 'signed-in');
			})
			.catch((error: unknown) => {
				if (isAbortError(error)) {
					return;
				}

				setUser(null);
				setStatus('signed-out');
			});

		return () => controller.abort();
	}, [repository]);

	const signIn = useCallback(
		async (email: string) => {
			const normalized = email.trim().toLowerCase();
			const page = await repository.users.search({ text: normalized }, { limit: 25 });
			const match = page.items.find((candidate) => candidate.email.toLowerCase() === normalized);

			if (!match) {
				throw new Error(`No account for ${email}. Try “Sign in as someone” below.`);
			}

			writeStoredUserId(match.id);
			setUser(match);
			setStatus('signed-in');
			return match;
		},
		[repository],
	);

	const signInAsRandomUser = useCallback(async () => {
		const page = await repository.users.search({}, { limit: 50 });
		const candidate = page.items[Math.floor(Math.random() * page.items.length)];

		if (!candidate) {
			throw new Error('The generated dataset has no users — check ?scale=.');
		}

		writeStoredUserId(candidate.id);
		setUser(candidate);
		setStatus('signed-in');
		return candidate;
	}, [repository]);

	const signOut = useCallback(() => {
		writeStoredUserId(null);
		setUser(null);
		setStatus('signed-out');
	}, []);

	const value = useMemo<SessionContextValue>(
		() => ({ status, user, signIn, signInAsRandomUser, signOut }),
		[status, user, signIn, signInAsRandomUser, signOut],
	);

	return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
	const value = use(SessionContext);

	if (value === null) {
		throw new Error('useSession() must be used inside <SessionProvider>.');
	}

	return value;
}

/** The signed-in user, for code that already runs behind `RequireAuth`. */
export function useCurrentUser(): User {
	const { user } = useSession();

	if (user === null) {
		throw new Error('useCurrentUser() used outside an authenticated route.');
	}

	return user;
}
