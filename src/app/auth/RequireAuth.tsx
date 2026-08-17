import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/app/session';
import { Spinner } from '@/ds/spinner';
import styles from './RequireAuth.module.css';

export function RequireAuth() {
	const { status } = useSession();
	const location = useLocation();

	if (status === 'loading') {
		return (
			<div className={styles.pending}>
				<Spinner size={20} label="Restoring your session" />
			</div>
		);
	}

	if (status === 'signed-out') {
		// The search string has to survive the bounce, not just ride along in `state`: the login
		// screen builds its own repository from the URL, and the session is keyed by seed. Dropping
		// it authenticates against the default dataset and files the session under a key the
		// deep-linked dataset will never look up — so sign-in silently fails to survive a reload on
		// any non-default seed.
		return (
			<Navigate
				to={{ pathname: '/login', search: location.search }}
				replace
				state={{ from: location.pathname + location.search }}
			/>
		);
	}

	return <Outlet />;
}
