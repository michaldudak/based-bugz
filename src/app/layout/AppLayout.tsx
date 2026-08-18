import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { APP_NAME, REPO_URL } from '@/app/config';
import { IMPL_OPTIONS } from '@/app/impls';
import { Logo } from '@/app/Logo';
import { useSession } from '@/app/session';
import { useTheme } from '@/app/theme';
import { Avatar } from '@/ds/avatar';
import { Button, ButtonLink } from '@/ds/button';
import { Dialog } from '@/ds/dialog';
import { IconFlask, IconGitHub, IconMenu, IconMoon, IconSun } from '@/ds/icons';
import { Menu } from '@/ds/menu';
import { useImplRegistry } from '@/ds/registry';
import { Tooltip } from '@/ds/tooltip';
import { CommandPaletteProvider } from '@/features/command-palette';
import { NavContent } from './NavContent';
import styles from './AppLayout.module.css';

/**
 * Which virtualization implementation this run uses — worn on the topbar, because a comparison
 * where you can forget which candidate you are currently judging produces impressions attributed
 * to the wrong API. Baseline is the quiet default and shows nothing.
 */
function ImplBadge() {
	const { activeName } = useImplRegistry();

	if (activeName === 'baseline') {
		return null;
	}

	return (
		<Tooltip content="Combobox and issues-list virtualization come from this implementation. Switch with ?impl=">
			<span className={styles.implBadge} data-testid="active-impl">
				{activeName}
			</span>
		</Tooltip>
	);
}

/**
 * The user-facing way to switch `?impl=`. The URL stays the source of truth — this menu just
 * writes it, so a chosen variant is still shareable as a link and survives reload.
 */
function ImplSwitcher() {
	const { activeName } = useImplRegistry();
	const { setImpl } = useTheme();

	return (
		<Menu
			trigger={
				<Button variant="ghost" iconOnly aria-label="Switch virtualization implementation">
					<IconFlask />
				</Button>
			}
			tooltip="Switch implementation"
			align="end"
		>
			<Menu.RadioGroup
				label="Implementation"
				value={activeName}
				onValueChange={(value) => setImpl(value as string)}
			>
				{IMPL_OPTIONS.map((option) => (
					<Menu.RadioItem key={option.value} value={option.value} label={option.label}>
						<span className={styles.implOption}>
							<span className={styles.implOptionName}>{option.label}</span>
							<span className={styles.implOptionDescription}>{option.description}</span>
						</span>
					</Menu.RadioItem>
				))}
			</Menu.RadioGroup>
		</Menu>
	);
}

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const isDark =
		theme === 'dark' ||
		(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

	return (
		<Tooltip content={isDark ? 'Switch to light' : 'Switch to dark'}>
			<Button
				variant="ghost"
				iconOnly
				aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
				onClick={() => setTheme(isDark ? 'light' : 'dark')}
			>
				{isDark ? <IconSun /> : <IconMoon />}
			</Button>
		</Tooltip>
	);
}

function RepoLink() {
	return (
		<Tooltip content="Source on GitHub">
			<ButtonLink
				href={REPO_URL}
				variant="ghost"
				iconOnly
				target="_blank"
				rel="noreferrer"
				aria-label={`${APP_NAME} source on GitHub (opens in a new tab)`}
			>
				<IconGitHub />
			</ButtonLink>
		</Tooltip>
	);
}

function UserMenu() {
	const { user, signOut } = useSession();

	if (!user) {
		return null;
	}

	return (
		<Menu
			trigger={
				<Button variant="ghost" className={styles.userButton} aria-label={`Account: ${user.name}`}>
					<Avatar name={user.name} initials={user.initials} hue={user.avatarHue} size="sm" />
					<span className={styles.userName}>{user.name}</span>
				</Button>
			}
			align="end"
		>
			<Menu.Group label={user.email}>
				<Menu.Item onClick={signOut}>Sign out</Menu.Item>
			</Menu.Group>
		</Menu>
	);
}

export function AppLayout() {
	const [navOpen, setNavOpen] = useState(false);
	const location = useLocation();

	// A drawer that survives navigation would cover the page you just asked for.
	useEffect(() => setNavOpen(false), [location.pathname]);

	return (
		<div className={styles.shell}>
			<header className={styles.topbar}>
				<Button
					variant="ghost"
					iconOnly
					className={styles.navToggle}
					aria-label="Open navigation"
					onClick={() => setNavOpen(true)}
				>
					<IconMenu />
				</Button>
				<span className={styles.brand}>
					<Logo size={15} />
					{APP_NAME}
				</span>
				<ImplBadge />
				<div className={styles.topbarEnd}>
					<ImplSwitcher />
					<RepoLink />
					<ThemeToggle />
					<UserMenu />
				</div>
			</header>

			<aside className={styles.sidebar}>
				<NavContent />
			</aside>

			<CommandPaletteProvider>
				<main className={styles.content}>
					<Outlet />
				</main>
			</CommandPaletteProvider>

			<Dialog open={navOpen} onOpenChange={setNavOpen} size="sm">
				<Dialog.Title>
					<span className={styles.brand}>
						<Logo size={18} />
						{APP_NAME}
					</span>
				</Dialog.Title>
				<NavContent onNavigate={() => setNavOpen(false)} />
			</Dialog>
		</div>
	);
}
