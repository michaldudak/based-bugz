import { useSearchParams } from 'react-router';
import { useComboboxImpl } from '@/ds/combobox';
import { Tabs } from '@/ds/tabs';
import { PerfOverlay, PerfToggle } from '@/lab/perf';
import { STRESS_CASES, findStressCase } from './cases';
import styles from './StressLabPage.module.css';

/**
 * The stress routes.
 *
 * Every case renders the same `<Combobox>` the app uses, so whichever implementation `?impl=`
 * resolved is the one being tortured. The cases are the situations a picker is allowed to be
 * merely slow in and not allowed to be wrong in — and each one carries the sentence that describes
 * its own failure, because a case nobody can describe the failure of is a case nobody will notice
 * failing.
 */
export function StressLabPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const { activeName } = useComboboxImpl();
	const active = findStressCase(searchParams.get('case'));

	function selectCase(id: string) {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set('case', id);
				return next;
			},
			{ replace: true },
		);
	}

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Stress lab</h1>
				<p className={styles.subtitle}>
					One picker, seven ways to break it. Implementation: <code>{activeName}</code>.
				</p>
				<div className={styles.headerControls}>
					<PerfToggle />
				</div>
			</header>

			<Tabs value={active.id} onValueChange={(value) => selectCase(String(value))}>
				<Tabs.List>
					{STRESS_CASES.map((entry) => (
						<Tabs.Tab key={entry.id} value={entry.id}>
							{entry.title}
						</Tabs.Tab>
					))}
				</Tabs.List>

				{/*
				 * One panel, always the active case. Only the case you are looking at is mounted: a
				 * hidden combobox still measures, still observes resize, and would land in the perf
				 * numbers of the one you meant to measure.
				 */}
				<Tabs.Panel value={active.id}>
					<section className={styles.case} data-testid="stress-case" data-case={active.id}>
						<h2 className={styles.caseTitle}>{active.title}</h2>
						<p className={styles.caseBreaks} data-testid="stress-case-breaks">
							<span className={styles.caseBreaksLabel}>Breaks like this:</span> {active.breaks}
						</p>
						{active.render()}
					</section>
				</Tabs.Panel>
			</Tabs>

			<PerfOverlay />
		</div>
	);
}
