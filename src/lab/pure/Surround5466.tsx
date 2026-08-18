/**
 * Pure-canary surroundings for pr-5466 (AGENTS.md — evaluation rule 12): a Dialog from the same
 * canary build the combobox implementation uses, so a bug reproduced here cannot be an artifact
 * of stable and canary packages coordinating across a package boundary.
 */

import { Dialog } from 'base-ui-5466/dialog';
import type { ReactNode } from 'react';
import styles from '@/ds/dialog/Dialog.module.css';

export function Surround({ children }: { children: ReactNode }) {
	return (
		<Dialog.Root open modal={false}>
			<Dialog.Portal>
				<Dialog.Popup
					className={`${styles.popup} ${styles.md}`}
					aria-label="Pure canary surroundings"
				>
					{children}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export default Surround;
