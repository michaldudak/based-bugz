import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { APP_NAME, APP_TAGLINE, REPO_URL } from '@/app/config';
import { Logo } from '@/app/Logo';
import { useSession } from '@/app/session';
import { Button, ButtonLink } from '@/ds/button';
import { Field } from '@/ds/field';
import { IconGitHub } from '@/ds/icons';
import { Input } from '@/ds/input';
import styles from './LoginPage.module.css';

interface LocationState {
	from?: string;
}

export function LoginPage() {
	const { signIn, signInAsRandomUser } = useSession();
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<'form' | 'random' | null>(null);

	const destination = (location.state as LocationState | null)?.from ?? '/issues';

	async function run(action: () => Promise<unknown>, kind: 'form' | 'random') {
		setError(null);
		setPending(kind);

		try {
			await action();
			await navigate(destination, { replace: true });
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Sign in failed. Try again.');
			setPending(null);
		}
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (email.trim() === '') {
			setError('Enter the email address of a seeded account.');
			return;
		}

		void run(() => signIn(email), 'form');
	}

	return (
		<main className={styles.page}>
			<div className={styles.card}>
				<header className={styles.header}>
					<Logo size={28} className={styles.logo} />
					<h1 className={styles.title}>{APP_NAME}</h1>
					<p className={styles.tagline}>{APP_TAGLINE}</p>
				</header>

				<form className={styles.form} onSubmit={handleSubmit} noValidate>
					<Field label="Email" error={error ?? undefined}>
						<Input
							type="email"
							name="email"
							value={email}
							onValueChange={setEmail}
							placeholder="you@example.com"
							autoComplete="username"
							// The page exists to be filled in; focusing its first field is the
							// expected behaviour for a dedicated sign-in screen.
							// oxlint-disable-next-line jsx-a11y/no-autofocus
							autoFocus
						/>
					</Field>

					<Field label="Password" description="Any password works — this is a fake sign-in.">
						<Input
							type="password"
							name="password"
							value={password}
							onValueChange={setPassword}
							placeholder="••••••••"
							autoComplete="current-password"
						/>
					</Field>

					<Button type="submit" variant="primary" fullWidth loading={pending === 'form'}>
						Sign in
					</Button>
				</form>

				<div className={styles.divider}>
					<span>or</span>
				</div>

				<Button
					fullWidth
					loading={pending === 'random'}
					onClick={() => void run(signInAsRandomUser, 'random')}
				>
					Sign in as someone
				</Button>

				<p className={styles.hint}>
					Accounts are generated from the dataset seed. “Sign in as someone” picks one at random so
					you never have to look an address up.
				</p>
			</div>

			<footer className={styles.footer}>
				<ButtonLink
					href={REPO_URL}
					variant="ghost"
					size="sm"
					target="_blank"
					rel="noreferrer"
					// Repeats the visible text so the new tab is announced without changing what the
					// link is called — voice control still matches the words on screen.
					aria-label={`${APP_NAME} on GitHub (opens in a new tab)`}
				>
					<IconGitHub />
					{APP_NAME} on GitHub
				</ButtonLink>
			</footer>
		</main>
	);
}
