/**
 * A text field that is always editable and saves when you leave it.
 *
 * No Edit button, and no separate "view" rendering: an issue title you can only change after
 * clicking a pencil is a form pretending to be a page. The commit moments are the ones people
 * already expect from a tracker — blur, and Enter (⌘/Ctrl+Enter where Enter means a newline) —
 * with Escape to abandon.
 *
 * The subtle requirement is the other direction. `value` is the cache, and the cache can change
 * underneath this component: an optimistic edit that the repository rejects gets rolled back, and
 * the field has to visibly follow it. So an incoming value is adopted whenever the field is not
 * being typed into, and ignored while it is — otherwise a rollback would fight the user's cursor.
 */

import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { Textarea } from '@/ds/textarea';
import { cx } from '@/ds/utils';
import styles from './InlineText.module.css';

export interface InlineTextProps {
	value: string;
	onCommit: (value: string) => void;
	/** Accessible name. There is no visible label — the field is the content. */
	label: string;
	/** Enter inserts a newline and ⌘/Ctrl+Enter saves, instead of Enter saving. */
	multiline?: boolean;
	/** Refuses to commit an empty value, reverting instead. */
	required?: boolean;
	minRows?: number;
	maxRows?: number;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function InlineText({
	value,
	onCommit,
	label,
	multiline = false,
	required = false,
	minRows = 1,
	maxRows = 16,
	placeholder,
	disabled,
	className,
}: InlineTextProps) {
	const [draft, setDraft] = useState(value);
	const [editing, setEditing] = useState(false);
	const [lastValue, setLastValue] = useState(value);
	/** Set by Escape, read by the blur it causes. See `handleBlur`. */
	const abandoned = useRef(false);

	if (value !== lastValue) {
		setLastValue(value);

		if (!editing) {
			setDraft(value);
		}
	}

	/*
	 * Blur is the *only* thing that writes. Enter and Escape do not commit or cancel themselves —
	 * they blur, and let this run.
	 *
	 * That is not tidiness. Calling `blur()` dispatches the blur handler synchronously, before React
	 * re-renders, so a key handler that also committed would fire the mutation twice: once itself and
	 * once from the blur, the second carrying a stale `draft` closure. Two writes for one Enter is
	 * bad enough; the real damage is that the second one's optimistic snapshot is taken *after* the
	 * first one already patched the cache, so rolling it back restores the edit instead of undoing
	 * it — a failed write that leaves the new value on screen, which is exactly the silent divergence
	 * `?errorRate=` exists to catch.
	 *
	 * The committed text is read off the DOM rather than from state for the same reason: it is the
	 * one value guaranteed not to be a render behind.
	 */
	function handleBlur(event: FocusEvent<HTMLTextAreaElement>): void {
		setEditing(false);

		if (abandoned.current) {
			abandoned.current = false;
			setDraft(value);
			return;
		}

		const raw = event.currentTarget.value;
		const next = multiline ? raw.trimEnd() : raw.trim();

		// Nothing changed, or an empty value a required field refuses: snap back either way.
		if (next === value || (required && next === '')) {
			setDraft(value);
			return;
		}

		setDraft(next);
		onCommit(next);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key === 'Escape') {
			// Stopped here so Escape means "abandon this edit" rather than "close the dialog this
			// field happens to be inside".
			event.stopPropagation();
			abandoned.current = true;
			event.currentTarget.blur();
			return;
		}

		if (event.key !== 'Enter') {
			return;
		}

		const saves = multiline ? event.metaKey || event.ctrlKey : !event.shiftKey;

		if (saves) {
			event.preventDefault();
			event.currentTarget.blur();
		}
	}

	return (
		<div className={cx(styles.root, className)}>
			<Textarea
				autoResize
				minRows={minRows}
				maxRows={maxRows}
				value={draft}
				aria-label={label}
				placeholder={placeholder}
				disabled={disabled}
				className={styles.input}
				onChange={(event) => setDraft(event.target.value)}
				onFocus={() => setEditing(true)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
			/>
			{editing && (
				<p className={styles.hint}>
					{multiline ? '⌘ + Enter or click away to save' : 'Enter to save'} · Esc to cancel
				</p>
			)}
		</div>
	);
}
