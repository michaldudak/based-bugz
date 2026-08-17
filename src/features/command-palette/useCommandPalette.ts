/**
 * Open state and the global keyboard surface.
 *
 * Two kinds of shortcut live here and they have opposite rules. ⌘K / Ctrl+K is the palette's own,
 * so it fires from anywhere — including while you are typing in a field, which is precisely where
 * a user most wants it. Command sequences are bare letters (`g i`, `c`, `t`), so they are
 * suppressed whenever focus sits in a text entry; otherwise typing "c" into a search box would
 * open the create dialog.
 */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveSequence } from './commands';
import type { CommandContext, PaletteCommand } from './commands';

export interface CommandPaletteControls {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteControls | null>(null);

/** For anything that wants to open the palette — a topbar search button, an empty-state link. */
export function useCommandPalette(): CommandPaletteControls {
	const controls = use(CommandPaletteContext);

	if (controls === null) {
		throw new Error('useCommandPalette() must be used inside <CommandPaletteProvider>.');
	}

	return controls;
}

/** How long a half-typed sequence (`g` waiting for `i`) stays live. */
const SEQUENCE_TIMEOUT = 1200;

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'checkbox',
	'color',
	'file',
	'image',
	'radio',
	'range',
	'reset',
	'submit',
]);

/**
 * Is the keystroke aimed at somewhere text goes? Checkboxes and radios are `<input>` too, and a
 * bare-letter shortcut should still work from one.
 */
function isTextEntry(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	if (target.isContentEditable) {
		return true;
	}

	if (target instanceof HTMLInputElement) {
		return !NON_TEXT_INPUT_TYPES.has(target.type);
	}

	return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function useCommandPaletteControls(
	commands: readonly PaletteCommand[],
	context: CommandContext,
): CommandPaletteControls {
	const [open, setOpen] = useState(false);
	const sequenceRef = useRef<readonly string[]>([]);
	const timerRef = useRef<number | undefined>(undefined);

	const resetSequence = useCallback(() => {
		window.clearTimeout(timerRef.current);
		sequenceRef.current = [];
	}, []);

	useEffect(() => () => window.clearTimeout(timerRef.current), []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
				// Chrome and Firefox both bind Ctrl+K to the address bar; a palette that only works
				// when the browser feels like it is not a palette.
				event.preventDefault();
				resetSequence();
				setOpen((current) => !current);
				return;
			}

			if (event.key === 'Escape') {
				// The dialog closes itself on Escape too. Doing it here as well means the requirement
				// holds no matter which surface inside the palette claimed the key first.
				resetSequence();
				setOpen(false);
				return;
			}

			if (open || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (isTextEntry(event.target)) {
				resetSequence();
				return;
			}

			const key = event.key.toLowerCase();

			if (key.length !== 1 || key === ' ') {
				resetSequence();
				return;
			}

			// A dead sequence should not eat the keystroke that follows it: `x` then `c` still runs
			// the command bound to `c`.
			const match =
				resolveSequence(commands, [...sequenceRef.current, key]) ??
				resolveSequence(commands, [key]);

			resetSequence();

			if (match === null) {
				return;
			}

			if (match.command !== null) {
				event.preventDefault();
				match.command.run(context);
				return;
			}

			sequenceRef.current = match.keys;
			timerRef.current = window.setTimeout(() => {
				sequenceRef.current = [];
			}, SEQUENCE_TIMEOUT);
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [commands, context, open, resetSequence]);

	return useMemo(
		() => ({ open, setOpen, toggle: () => setOpen((current) => !current) }),
		[open, setOpen],
	);
}
