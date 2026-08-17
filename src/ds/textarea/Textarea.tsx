import type { ChangeEvent, CSSProperties, TextareaHTMLAttributes } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { Field as BaseField } from '@base-ui/react/field';
import { cx } from '@/ds/utils';
import styles from './Textarea.module.css';

export interface TextareaProps extends Omit<
	TextareaHTMLAttributes<HTMLTextAreaElement>,
	'className' | 'style' | 'rows'
> {
	/** Starting height, in rows. Also the floor when `autoResize` is on. */
	minRows?: number;
	/** Ceiling for `autoResize`, in rows. Past this the textarea scrolls. */
	maxRows?: number;
	/** Grow with the content instead of showing an inner scrollbar. */
	autoResize?: boolean;
	className?: string;
	style?: CSSProperties;
}

/**
 * Multiline text control.
 *
 * Base UI ships no Textarea, so this borrows `Field.Control`'s Field wiring (id,
 * `aria-describedby`, validation, `data-*` state) and swaps the element for a
 * `<textarea>`. `render` is used here, inside the wrapper — it is not re-exposed.
 */
export function Textarea({
	minRows = 3,
	maxRows = 12,
	autoResize = false,
	disabled,
	className,
	style,
	onChange,
	...props
}: TextareaProps) {
	const elementRef = useRef<HTMLTextAreaElement | null>(null);

	/*
	 * The floor and ceiling live in CSS, in `em`, so this never reads computed style —
	 * only `scrollHeight`, which is what actually has to be measured.
	 */
	const resize = useCallback(() => {
		const element = elementRef.current;

		if (!element || !autoResize) {
			return;
		}

		element.style.height = 'auto';
		element.style.height = `${element.scrollHeight}px`;
	}, [autoResize]);

	/*
	 * Wrapping depends on width, so height has to be recomputed whenever width changes
	 * — and the observer's first callback is also the first moment the element is
	 * guaranteed to *have* a width. Measuring once in a mount effect is not equivalent:
	 * a tree that mounts while its tab is backgrounded (or inside a hidden container)
	 * measures a zero-width viewport, bakes in a height ten times too tall, and never
	 * corrects itself.
	 */
	useLayoutEffect(() => {
		const element = elementRef.current;

		if (!element || !autoResize) {
			return undefined;
		}

		let lastWidth = -1;
		const observer = new ResizeObserver(() => {
			// Guard the feedback loop: `resize` changes height, which notifies us again.
			if (element.clientWidth === lastWidth) {
				return;
			}

			lastWidth = element.clientWidth;
			resize();
		});

		observer.observe(element);

		return () => observer.disconnect();
	}, [autoResize, resize]);

	// A controlled value can change without the width changing.
	useLayoutEffect(resize, [resize, props.value]);

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			resize();
			onChange?.(event);
		},
		[onChange, resize],
	);

	const bounds = autoResize
		? ({ '--textarea-min-rows': minRows, '--textarea-max-rows': maxRows } as CSSProperties)
		: undefined;

	return (
		<BaseField.Control
			disabled={disabled}
			className={cx(styles.textarea, autoResize && styles.autoResize, className)}
			style={{ ...bounds, ...style }}
			render={<textarea rows={minRows} ref={elementRef} onChange={handleChange} {...props} />}
		/>
	);
}
