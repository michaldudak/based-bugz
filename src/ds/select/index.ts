export { Select } from './Select';
export { StaticSelect } from './StaticSelect';
export type { StaticSelectOption, StaticSelectProps } from './StaticSelect';
export type { SelectImplComponent, SelectProps, SelectSize } from './types';

/**
 * The shared CSS Module, exported for implementations: impls compose their own package's Select
 * parts and apply these classNames to them, so every implementation looks identical and the diff
 * between them stays about API, not styling (AGENTS.md — evaluation rule 2).
 */
export { default as selectStyles } from './Select.module.css';
