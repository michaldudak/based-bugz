import { NavLink } from 'react-router';
import { IconInbox, IconSettings, IconTag } from '@/ds/icons';
import { cx } from '@/ds/utils';
import styles from './NavContent.module.css';

const LINKS = [
	{ to: '/issues', label: 'Issues', icon: IconInbox },
	{ to: '/settings', label: 'Settings', icon: IconSettings },
	{ to: '/lab/ds', label: 'Design system', icon: IconTag },
] as const;

export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<nav className={styles.nav} aria-label="Main">
			{LINKS.map(({ to, label, icon: Icon }) => (
				<NavLink
					key={to}
					to={to}
					onClick={onNavigate}
					className={({ isActive }) => cx(styles.link, isActive && styles.active)}
				>
					<Icon />
					{label}
				</NavLink>
			))}
		</nav>
	);
}
