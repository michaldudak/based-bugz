import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '@/app/auth/LoginPage';
import { RequireAuth } from '@/app/auth/RequireAuth';
import { AppLayout } from '@/app/layout/AppLayout';
import { IssuesPage } from '@/app/pages/IssuesPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { Providers } from '@/app/providers';
import { DsGalleryPage } from '@/lab/ds/DsGalleryPage';

export function App() {
	return (
		<BrowserRouter>
			{/* Providers sit inside the router: theme and dataset settings are URL state. */}
			<Providers>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route element={<RequireAuth />}>
						<Route element={<AppLayout />}>
							<Route index element={<Navigate to="/issues" replace />} />
							<Route path="issues" element={<IssuesPage />} />
							<Route path="settings" element={<SettingsPage />} />
							<Route path="lab/ds" element={<DsGalleryPage />} />
						</Route>
					</Route>
					<Route path="*" element={<Navigate to="/issues" replace />} />
				</Routes>
			</Providers>
		</BrowserRouter>
	);
}
