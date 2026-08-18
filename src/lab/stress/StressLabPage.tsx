import { useSearchParams } from 'react-router';
import { useImplRegistry } from '@/ds/registry';
import { Page } from '@/ds/page';
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
	const { activeName } = useImplRegistry();
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
		<Page>
			<Page.Header actions={<PerfToggle />}>
				<Page.Title>Stress lab</Page.Title>
				<Page.Subtitle>
					One picker, seven ways to break it. Implementation: <code>{activeName}</code>.
				</Page.Subtitle>
			</Page.Header>

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
					{/* A plain section, not `Page.Section`: the parity suite hooks onto these data attributes. */}
					<section className={styles.case} data-testid="stress-case" data-case={active.id}>
						<Page.SectionTitle>{active.title}</Page.SectionTitle>
						<p className={styles.caseBreaks} data-testid="stress-case-breaks">
							<span className={styles.caseBreaksLabel}>Breaks like this:</span> {active.breaks}
						</p>
						{active.render()}
					</section>
				</Tabs.Panel>
			</Tabs>

			<PerfOverlay />
		</Page>
	);
}
