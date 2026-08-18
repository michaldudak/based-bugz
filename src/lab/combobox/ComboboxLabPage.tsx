import { Page } from '@/ds/page';
import { UserPickerLab } from './UserPickerLab';

/**
 * Where combobox implementations are exercised against the real repository. Switch
 * implementation with `?impl=` — the same page, the same rows, the same CSS.
 */
export function ComboboxLabPage() {
	return (
		<Page>
			<Page.Header>
				<Page.Title>Combobox lab</Page.Title>
				<Page.Subtitle>
					Async paging, variable-height rows, grouping, multi-select and keyboard navigation over a
					list nobody wants to render all of.
				</Page.Subtitle>
			</Page.Header>
			<UserPickerLab />
		</Page>
	);
}
