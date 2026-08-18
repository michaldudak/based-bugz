/** Placeholder until the pr-5414 implementation lands (PLAN.md — Phase 9). */

import { listStyles as s } from '@/ds/list';
import type { ListProps } from '@/ds/list';
import { cx } from '@/ds/utils';

const PLACEHOLDER_LIMIT = 100;

export function PendingList<T>(props: ListProps<T>) {
	const shown = props.items.slice(0, PLACEHOLDER_LIMIT);

	return (
		<div className={cx(s.scroller, props.className)}>
			<output>
				pr-5414 List is not implemented yet — rendering the first {PLACEHOLDER_LIMIT} rows without
				virtualization.
			</output>
			<ul className={s.viewport}>
				{shown.map((item, index) => props.renderItem(item, index, {}))}
			</ul>
			{props.trailing}
		</div>
	);
}

export default PendingList;
