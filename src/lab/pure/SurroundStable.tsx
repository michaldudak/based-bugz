/**
 * The control surroundings: the same Dialog markup as the canary variants, from stable
 * `@base-ui/react`. `?impl=baseline` here is the all-stable reference; a canary impl inside these
 * surroundings is the mixed pairing the app itself ships.
 */

import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import styles from '@/ds/dialog/Dialog.module.css';

export function Surround({ children }: { children: ReactNode }) {
	return (
		<Dialog.Root open modal={false}>
			<Dialog.Portal>
				<Dialog.Popup className={`${styles.popup} ${styles.md}`} aria-label="Stable surroundings">
					{children}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export default Surround;
