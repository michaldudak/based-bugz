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
		// `from` is what sends you back to the deep link you actually asked for.
		return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
	}

	return <Outlet />;
}
