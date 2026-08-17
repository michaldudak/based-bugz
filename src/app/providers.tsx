import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RepositoryProvider } from '@/data';
import { ToastProvider } from '@/ds/toast';
import { TooltipProvider } from '@/ds/tooltip';
import { SessionProvider } from './session';
import { ThemeProvider } from './theme';

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// The repository is the source of truth and never changes underneath us without a
				// mutation, so background refetching would only add noise to perf measurements.
				refetchOnWindowFocus: false,
				staleTime: 30_000,
				retry: 0,
			},
		},
	});
}

/**
 * Order matters: Repository must wrap Session (it resolves the stored user), and Theme needs the
 * router to be mounted above it because it reads and writes search params.
 */
export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(createQueryClient);

	return (
		<QueryClientProvider client={queryClient}>
			<RepositoryProvider>
				<SessionProvider>
					<ThemeProvider>
						<TooltipProvider>
							<ToastProvider>{children}</ToastProvider>
						</TooltipProvider>
					</ThemeProvider>
				</SessionProvider>
			</RepositoryProvider>
		</QueryClientProvider>
	);
}
