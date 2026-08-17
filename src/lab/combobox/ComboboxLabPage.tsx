import { UserPickerLab } from './UserPickerLab';
import styles from './ComboboxLabPage.module.css';

/**
 * Where combobox implementations are exercised against the real repository. Switch
 * implementation with `?impl=` — the same page, the same rows, the same CSS.
 */
export function ComboboxLabPage() {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Combobox lab</h1>
				<p className={styles.subtitle}>
					Async paging, variable-height rows, grouping, multi-select and keyboard navigation over a
					list nobody wants to render all of.
				</p>
			</header>
			<UserPickerLab />
		</div>
	);
}
