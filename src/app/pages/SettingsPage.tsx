import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTheme } from '@/app/theme';
import { dataParamsToSearch, parseDataParams } from '@/data';
import { Button } from '@/ds/button';
import { Field } from '@/ds/field';
import { Input } from '@/ds/input';
import { Select } from '@/ds/select';
import { Separator } from '@/ds/separator';
import styles from './SettingsPage.module.css';

const THEMES = [
	{ value: 'system', label: 'Follow system' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
] as const;

const DENSITIES = [
	{ value: 'comfortable', label: 'Comfortable' },
	{ value: 'compact', label: 'Compact' },
] as const;

const DIRECTIONS = [
	{ value: 'ltr', label: 'Left to right' },
	{ value: 'rtl', label: 'Right to left' },
] as const;

/**
 * The URL control surface, as UI. Appearance applies instantly; dataset params rebuild the
 * generated world, so they apply on reload — which is also what you want before a perf run.
 */
export function SettingsPage() {
	const { theme, density, dir, setTheme, setDensity, setDirection } = useTheme();
	const [searchParams] = useSearchParams();
	const [data, setData] = useState(() => parseDataParams(searchParams.toString()));

	function applyDataParams(options: { fresh?: boolean } = {}) {
		const next = dataParamsToSearch(data);

		// Appearance is UI state and must survive a dataset reload.
		for (const key of ['theme', 'density', 'dir', 'impl'] as const) {
			const value = searchParams.get(key);

			if (value !== null) {
				next.set(key, value);
			}
		}

		if (options.fresh) {
			next.set('fresh', '1');
		}

		const query = next.toString();
		window.location.search = query === '' ? '' : `?${query}`;
	}

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Settings</h1>
				<p className={styles.subtitle}>
					Every setting here is a URL parameter, so any configuration is reproducible from its link.
				</p>
			</header>

			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Appearance</h2>
				<div className={styles.grid}>
					<Field label="Theme" nativeLabel={false}>
						{/* Base UI's onValueChange is nullable for clearable selects; ours never clear. */}
						<Select
							items={THEMES}
							value={theme}
							onValueChange={(value) => value !== null && setTheme(value)}
						/>
					</Field>
					<Field label="Density" nativeLabel={false}>
						<Select
							items={DENSITIES}
							value={density}
							onValueChange={(value) => value !== null && setDensity(value)}
						/>
					</Field>
					<Field
						label="Direction"
						nativeLabel={false}
						description="RTL is where popup positioning tends to break."
					>
						<Select
							items={DIRECTIONS}
							value={dir}
							onValueChange={(value) => value !== null && setDirection(value)}
						/>
					</Field>
				</div>
			</section>

			<Separator />

			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Dataset</h2>
				<p className={styles.sectionNote}>
					The generated world. Changing any of these rebuilds it, so they apply on reload.
				</p>
				<div className={styles.grid}>
					<Field label="Seed" description="Same seed, identical data.">
						<Input
							value={data.seed}
							onValueChange={(seed) => setData((current) => ({ ...current, seed }))}
						/>
					</Field>
					<Field label="Issues" description="Users, labels and projects scale with this.">
						<Input
							type="number"
							min={1}
							value={String(data.scale)}
							onValueChange={(value) =>
								setData((current) => ({ ...current, scale: Number(value) || current.scale }))
							}
						/>
					</Field>
					<Field label="Latency (ms)" description="Applied with ±30% jitter.">
						<Input
							type="number"
							min={0}
							value={String(data.latency)}
							onValueChange={(value) =>
								setData((current) => ({ ...current, latency: Math.max(0, Number(value) || 0) }))
							}
						/>
					</Field>
					<Field label="Error rate" description="0–1. Exercises rollbacks and retries.">
						<Input
							type="number"
							min={0}
							max={1}
							step={0.05}
							value={String(data.errorRate)}
							onValueChange={(value) =>
								setData((current) => ({
									...current,
									errorRate: Math.min(1, Math.max(0, Number(value) || 0)),
								}))
							}
						/>
					</Field>
				</div>
				<div className={styles.actions}>
					<Button variant="primary" onClick={() => applyDataParams()}>
						Apply and reload
					</Button>
					<Button variant="danger" onClick={() => applyDataParams({ fresh: true })}>
						Discard my edits
					</Button>
				</div>
			</section>
		</div>
	);
}
