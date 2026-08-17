import { DirectionProvider } from '@base-ui/react/direction-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { RepositoryProvider } from '@/data';
import { ComboboxImplProvider } from '@/ds/combobox';
import { ToastProvider } from '@/ds/toast';
import { TooltipProvider } from '@/ds/tooltip';
import { IMPL_NAMES, resolveImpl } from './impls';
import { parseUiParams } from './params';
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
	const [searchParams] = useSearchParams();

	const registry = useMemo(() => {
		const { impl } = parseUiParams(searchParams);
		const { name, component } = resolveImpl(impl);
		return { active: component, activeName: name, available: IMPL_NAMES };
	}, [searchParams]);

	// Base UI reads direction from context, not from the DOM. Without this, `?dir=rtl` restyles the
	// page but every Base UI RTL path — list navigation, positioner alignment, the input's own
	// caret branch — still runs as LTR, which makes RTL testing worthless.
	const { dir } = parseUiParams(searchParams);

	return (
		<QueryClientProvider client={queryClient}>
			<RepositoryProvider>
				<SessionProvider>
					<ThemeProvider>
						<DirectionProvider direction={dir}>
							<ComboboxImplProvider registry={registry}>
								<TooltipProvider>
									<ToastProvider>{children}</ToastProvider>
								</TooltipProvider>
							</ComboboxImplProvider>
						</DirectionProvider>
					</ThemeProvider>
				</SessionProvider>
			</RepositoryProvider>
		</QueryClientProvider>
	);
}
