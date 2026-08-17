/**
 * Pure `(seed, index) → entity` generators.
 *
 * Nothing here ever builds a full array. `createGenerator()` hands back accessors that produce one
 * entity on demand and cache it in a bounded sparse `Map`, so `?scale=100000` costs nothing at boot
 * (AGENTS.md — evaluation rule 10).
 *
 * The string pools are deliberately hostile: CJK, Arabic and Hebrew, Cyrillic, Devanagari, emoji,
 * accented Latin, near-duplicate names, unbreakable 90-character words, one ~300-character title
 * and a handful of whitespace-only descriptions. Tastefully uniform data flatters every
 * implementation equally, which is exactly what we cannot afford.
 */

import { chance, createRng, distinctInts, hash32, int, pick } from './rng';
import type {
	Comment,
	CommentId,
	Issue,
	IssueId,
	Label,
	LabelId,
	Project,
	ProjectId,
	User,
	UserId,
} from './types';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from './types';

/* -------------------------------------------------------------------------------------------- */
/* Shape                                                                                          */
/* -------------------------------------------------------------------------------------------- */

export interface DatasetShape {
	seed: string;
	users: number;
	labels: number;
	projects: number;
	issues: number;
}

/** Fixed anchor for every generated timestamp, so data never drifts with the wall clock. */
export const DATA_EPOCH = Date.UTC(2026, 7, 1);

/** Generated issues span roughly three years back from `DATA_EPOCH`. */
const HISTORY_SPAN_MS = 3 * 365 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * `scale` is the absolute issue count; every other entity count derives from it, so one number
 * moves the whole dataset. The default of 10 000 reproduces the sizes PLAN.md calls for:
 * 10k issues, 5k users, 200 labels, 12 projects.
 */
export function datasetShape(seed: string, scale: number): DatasetShape {
	const issues = clamp(Math.round(scale), 1, 5_000_000);

	return {
		seed,
		issues,
		users: clamp(Math.round(issues / 2), 1, 1_000_000),
		labels: clamp(Math.round(issues / 50), 8, 20_000),
		projects: clamp(Math.floor(issues / 800), 3, 60),
	};
}

/* -------------------------------------------------------------------------------------------- */
/* Identifiers                                                                                    */
/* -------------------------------------------------------------------------------------------- */

/*
 * Generated ids embed their index, so `issues.byId()` is O(1) without a lookup table. Entities
 * created at runtime use an `<prefix>n-` prefix, which `parseGeneratedIndex` rejects.
 */

export const USER_ID_PREFIX = 'u';
export const LABEL_ID_PREFIX = 'l';
export const PROJECT_ID_PREFIX = 'p';
export const ISSUE_ID_PREFIX = 'i';
export const COMMENT_ID_PREFIX = 'c';

export function userIdAt(index: number): UserId {
	return `${USER_ID_PREFIX}${index}`;
}

export function labelIdAt(index: number): LabelId {
	return `${LABEL_ID_PREFIX}${index}`;
}

export function projectIdAt(index: number): ProjectId {
	return `${PROJECT_ID_PREFIX}${index}`;
}

export function issueIdAt(index: number): IssueId {
	return `${ISSUE_ID_PREFIX}${index}`;
}

/** `null` when the id was not produced by the generator (a runtime-created entity, or garbage). */
export function parseGeneratedIndex(prefix: string, id: string): number | null {
	if (!id.startsWith(prefix)) {
		return null;
	}

	const digits = id.slice(prefix.length);

	if (digits.length === 0 || !/^\d+$/.test(digits)) {
		return null;
	}

	return Number(digits);
}

/* -------------------------------------------------------------------------------------------- */
/* Hostile string pools                                                                           */
/* -------------------------------------------------------------------------------------------- */

interface NamePool {
	given: readonly string[];
	family: readonly string[];
	/** Some scripts write family name first, and some join without a space. */
	familyFirst: boolean;
	separator: string;
	weight: number;
}

const NAME_POOLS: readonly NamePool[] = [
	{
		given: [
			'Alex',
			'Alexandra',
			'Zoë',
			'Renée',
			'Björn',
			'João',
			'Ana',
			'Łukasz',
			'Mateo',
			'Íñigo',
			'Siobhán',
			'Jean-Luc',
			'Émilie',
			'Ousmane',
			'Chiamaka',
			'Nikolaj',
			'Þóra',
			'Mihaela',
		],
		family: [
			'Chen',
			'Chén',
			'Müller',
			'Gonçalves',
			'Ruiz',
			'Åkesson',
			'Dubois',
			'Wójcik',
			'O’Brien',
			'Nakamura',
			'Adeyemi',
			'Kowalski',
			'de la Cruz',
			'Þórsdóttir',
			'Ekström',
			'Vandenberghe',
			'Ivanović',
			'Þorláksson',
		],
		familyFirst: false,
		separator: ' ',
		weight: 40,
	},
	{
		given: ['さくら', '大輝', '陽菜', '翔太', '美咲', '蓮', 'ひまり', '悠真'],
		family: ['田中', '佐藤', '山田', '鈴木', '高橋', '伊藤', '渡辺', '中村'],
		familyFirst: true,
		separator: ' ',
		weight: 12,
	},
	{
		given: ['明', '小美', '伟', '浩然', '雨欣', '子涵', '思远'],
		family: ['李', '王', '张', '刘', '陈', '杨', '黄'],
		familyFirst: true,
		separator: '',
		weight: 12,
	},
	{
		given: ['민준', '서연', '지훈', '하윤', '도현'],
		family: ['김', '이', '박', '최', '정'],
		familyFirst: true,
		separator: '',
		weight: 5,
	},
	{
		given: ['أحمد', 'فاطمة', 'محمد', 'ليلى', 'يوسف', 'مريم'],
		family: ['الفارسي', 'الزهراء', 'بن سالم', 'حداد', 'العتيبي', 'خليل'],
		familyFirst: false,
		separator: ' ',
		weight: 9,
	},
	{
		given: ['שרה', 'יוסי', 'נועה', 'איתי', 'תמר'],
		family: ['כהן', 'לוי', 'בן־דוד', 'מזרחי', 'פרידמן'],
		familyFirst: false,
		separator: ' ',
		weight: 6,
	},
	{
		given: ['Мария', 'Дмитрий', 'Ольга', 'Алексей', 'Екатерина'],
		family: ['Иванова', 'Соколов', 'Петрова', 'Кузнецов', 'Морозова'],
		familyFirst: false,
		separator: ' ',
		weight: 7,
	},
	{
		given: ['प्रिया', 'राहुल', 'अनन्या', 'विक्रम'],
		family: ['शर्मा', 'वर्मा', 'गुप्ता', 'नायर'],
		familyFirst: false,
		separator: ' ',
		weight: 5,
	},
	{
		given: ['Ελένη', 'Γιώργος', 'สมชาย', 'มาลี', 'Nguyễn', 'Trần'],
		family: ['Παπαδοπούλου', 'Αθανασίου', 'ใจดี', 'ศรีสุข', 'Thị Hương', 'Văn Minh'],
		familyFirst: false,
		separator: ' ',
		weight: 4,
	},
];

const NAME_POOL_TOTAL_WEIGHT = NAME_POOLS.reduce((sum, pool) => sum + pool.weight, 0);

/**
 * Every picker in this app has to cope with these. Exact duplicates, case-only differences,
 * diacritic-only differences, a double space, and a trailing space — all under one apparent name.
 */
const NEAR_DUPLICATE_NAMES: readonly string[] = [
	'Alex Chen',
	'Alex Chén',
	'alex chen',
	'ALEX CHEN',
	'Alex  Chen',
	'Alex Chen ',
	'Àlex Chen',
	'Alex Chen',
	'Alex Cheng',
	'Alexander Chen',
	'陈亚历',
	'Alex Chen',
	'Аlex Chen',
	'Alex Chen',
];

const EMOJI_NAMES: readonly string[] = [
	'Sam 🦆 Okafor',
	'🐛 Bugmaster',
	'Priya ✨ Sharma',
	'Jo 🌵',
	'Kenji 🍣 森',
	'مها 🌙 سعيد',
	'👩‍💻 Dana Reyes',
	'Théo 🇫🇷 Marchand',
];

/** No soft hyphens, no spaces — these are the strings that blow out a fixed-width row. */
const UNBREAKABLE_NAMES: readonly string[] = [
	'Bartholomäus Wolfeschlegelsteinhausenbergerdorff',
	'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetzbeauftragte',
	'Supercalifragilisticexpialidociousenkopfschmerzensbekämpfungsmittel',
];

const JOB_TITLES: readonly string[] = [
	'Frontend Engineer',
	'Staff Engineer',
	'Senior Engineer',
	'Engineering Manager',
	'Design Systems Engineer',
	'QA Engineer',
	'Product Designer',
	'Accessibility Specialist',
	'Developer Advocate',
	'デザイナー',
	'フロントエンドエンジニア',
	'前端工程师',
	'مهندس برمجيات',
	'מהנדסת חזית',
	'Инженер по качеству',
	'वरिष्ठ अभियंता',
	'Principal Engineer, Rendering & Measurement Infrastructure',
];

const TEAMS: readonly string[] = [
	'Core',
	'Platform',
	'Design Systems',
	'Growth',
	'Infrastructure',
	'Mobile',
	'Docs',
	'設計チーム',
	'性能小组',
	'بنية تحتية',
	'צוות נגישות',
	'Мобильные',
	'Accessibility',
];

const COMPONENTS: readonly string[] = [
	'Combobox',
	'Dialog',
	'Menu',
	'Tooltip',
	'Select',
	'Popover',
	'Toolbar',
	'Field',
	'Autocomplete',
	'ScrollArea',
	'ダイアログ',
	'弹出框',
	'القائمة المنسدلة',
	'תפריט הקשר',
	'Всплывающее окно',
];

const PROBLEMS: readonly string[] = [
	'loses focus',
	'flickers on open',
	'misreports aria-setsize',
	'scrolls to the wrong row',
	'throws on unmount',
	'leaks a ResizeObserver',
	'ignores prefers-reduced-motion',
	'double-fires onOpenChange',
	'measures rows as 0px',
	'traps Tab',
	'が閉じない',
	'不响应键盘导航',
	'لا يستجيب للوحة المفاتيح',
	'לא נסגר בלחיצה מחוץ',
	'не восстанавливает фокус',
];

const CONTEXTS: readonly string[] = [
	'inside a Portal',
	'with dir="rtl"',
	'at 200% browser zoom',
	'on iOS Safari',
	'during momentum scrolling',
	'under StrictMode',
	'when the list is empty',
	'with 100k rows',
	'after a filter clears the list',
	'while the popup is animating',
	'on a 360px viewport',
	'with the on-screen keyboard open',
	'モバイルで',
	'في الوضع الليلي',
];

const TITLE_PREFIXES: readonly string[] = ['', '', '', '', '🔥 ', '🐛 ', '♿️ ', '⚡️ ', '[a11y] '];

const LABEL_BASES: readonly string[] = [
	'bug',
	'regression',
	'needs-repro',
	'a11y',
	'perf',
	'good first issue',
	'wontfix',
	'docs',
	'flaky',
	'blocked',
	'design',
	'breaking-change',
	'パフォーマンス',
	'アクセシビリティ',
	'回归',
	'待复现',
	'عاجل',
	'تحسين',
	'דחוף',
	'נגישות',
	'производительность',
	'🔥 hot',
	'✨ polish',
	'🧪 experiment',
	'needs-design-review-before-any-implementation-work-starts',
];

const LABEL_AREAS: readonly string[] = [
	'combobox',
	'dialog',
	'menu',
	'select',
	'popover',
	'tooltip',
	'field',
	'scroll',
	'focus',
	'aria',
	'rtl',
	'mobile',
	'安卓',
	'ios',
	'firefox',
	'safari',
	'chrome',
	'ssr',
];

const PROJECT_NAMES: readonly [string, string][] = [
	['CORE', 'Core Runtime'],
	['PLAT', 'プラットフォーム'],
	['DS', 'Design Systems'],
	['MOB', 'Mobile Shell'],
	['INFRA', 'بنية تحتية'],
	['WEB', 'Web Client'],
	['API', 'Public API'],
	['DOCS', 'תיעוד'],
	['QA', 'Quality & Release'],
	['GROW', 'Growth Experiments'],
	['LAB', '实验室'],
	['EDGE', 'Edge Delivery'],
];

const DESCRIPTION_OPENERS: readonly string[] = [
	'Steps to reproduce:',
	'再現手順:',
	'复现步骤:',
	'خطوات إعادة الإنتاج:',
	'שלבים לשחזור:',
	'Repro:',
	'Context:',
];

const DESCRIPTION_BODIES: readonly string[] = [
	'1. Open the picker\n2. Type three characters\n3. Press ArrowDown twice\n4. Observe the highlighted row',
	'Only reproduces once the list has scrolled past the initial window. A fresh mount is fine.',
	'Screen reader announces the wrong position. `aria-posinset` is one-based in the DOM but zero-based in the measurement cache.',
	'このバグは日本語入力の変換確定時にのみ発生します。IME の composition イベント中に再描画が走っているようです。',
	'仅在虚拟列表回收行时出现，滚动条位置会跳回顶部。',
	'المشكلة تظهر فقط عند تفعيل الاتجاه من اليمين إلى اليسار مع قائمة طويلة.',
	'הבעיה מופיעה רק כשהחלון קטן מ־400 פיקסלים.',
	'```tsx\n<Combobox.Root open onOpenChange={noop}>\n\t<Combobox.Input />\n</Combobox.Root>\n```\n\nSame result with and without the Portal.',
	'Filed from the triage rotation. Low confidence in the repro — reassign freely. 🙃',
];

/** Descriptions that look empty but are not. The renderer has to decide what to do with them. */
const BLANK_DESCRIPTIONS: readonly string[] = ['', '   ', '\n\n\t\n  ', '​', '   ​\n'];

const COMMENT_BODIES: readonly string[] = [
	'Can confirm on Firefox 148.',
	'Not reproducible for me — what OS?',
	'I think this is the same root cause as the measurement cache issue.',
	'再現しました。RTL でも同様です。',
	'我这边也遇到了，滚动到第 300 行左右开始出现。',
	'أستطيع إعادة إنتاج المشكلة على متصفح سفاري.',
	'ראיתי את זה גם עם מקלדת חיצונית.',
	'Fixed by the row-measurement rewrite? Worth re-testing. 🤞',
	'Bumping — still happening on the preview build.',
	'```\nUncaught TypeError: Cannot read properties of undefined (reading "start")\n```',
	'👍',
	'🤔',
];

/* -------------------------------------------------------------------------------------------- */
/* String helpers                                                                                 */
/* -------------------------------------------------------------------------------------------- */

/** Code-point-safe truncation — slicing a surrogate pair produces a replacement character. */
function truncateCodePoints(text: string, length: number): string {
	const points = Array.from(text);

	return points.length <= length ? text : points.slice(0, length).join('');
}

function padToCodePoints(text: string, length: number, filler: string): string {
	let result = text;

	while (Array.from(result).length < length) {
		result += filler;
	}

	return truncateCodePoints(result, length);
}

function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/u).filter(Boolean);
	const letters: string[] = [];

	for (const word of words.slice(0, 2)) {
		const first = Array.from(word)[0];

		if (first !== undefined) {
			letters.push(first);
		}
	}

	if (letters.length === 0) {
		return '?';
	}

	return letters.join('').toLocaleUpperCase('en-US');
}

/**
 * Emails have to stay unique and typeable — fake login matches on them — so the display name is
 * folded to ASCII and disambiguated with the index. CJK-only names fold to nothing and fall back.
 */
function emailFor(name: string, index: number): string {
	const folded = name
		.normalize('NFKD')
		.replace(/[^\p{ASCII}]/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '.')
		.replace(/^\.+|\.+$/g, '');

	const slug = folded.length > 0 ? truncateCodePoints(folded, 24) : 'user';

	return `${slug}.${index}@basedbugz.dev`;
}

function weightedNamePool(value: number): NamePool {
	let cursor = value * NAME_POOL_TOTAL_WEIGHT;

	for (const pool of NAME_POOLS) {
		cursor -= pool.weight;

		if (cursor < 0) {
			return pool;
		}
	}

	const fallback = NAME_POOLS[0];

	if (fallback === undefined) {
		throw new Error('NAME_POOLS is empty');
	}

	return fallback;
}

function cycle<T>(values: readonly T[], index: number): T {
	const value = values[((index % values.length) + values.length) % values.length];

	if (value === undefined) {
		throw new Error('cycle(): empty pool');
	}

	return value;
}

/* -------------------------------------------------------------------------------------------- */
/* Entity generators                                                                              */
/* -------------------------------------------------------------------------------------------- */

export function makeUser(shape: DatasetShape, index: number): User {
	const rng = createRng(shape.seed, 'user', index);
	let name: string;

	// Deterministic hostile slots. The moduli are coprime-ish so the classes rarely collide, and
	// every one of them is reachable at the default scale.
	if (index % 17 === 0) {
		name = cycle(NEAR_DUPLICATE_NAMES, Math.floor(index / 17));
	} else if (index % 211 === 5) {
		name = cycle(UNBREAKABLE_NAMES, Math.floor(index / 211));
	} else if (index % 53 === 7) {
		name = cycle(EMOJI_NAMES, Math.floor(index / 53));
	} else {
		const pool = weightedNamePool(rng());
		const given = pick(rng, pool.given);
		const family = pick(rng, pool.family);
		const parts = pool.familyFirst ? [family, given] : [given, family];
		name = parts.join(pool.separator);
	}

	return {
		id: userIdAt(index),
		name,
		email: emailFor(name, index),
		initials: initialsOf(name),
		avatarHue: hash32(`${shape.seed}:hue:${index}`) % 361,
		title: pick(rng, JOB_TITLES),
		team: pick(rng, TEAMS),
	};
}

export function makeLabel(shape: DatasetShape, index: number): Label {
	const base = cycle(LABEL_BASES, index);
	// The first pass through the pool uses bare names, so near-duplicates like `bug` and
	// `bug/combobox` coexist and label pickers cannot key on the name.
	const name = index < LABEL_BASES.length ? base : `${base}/${cycle(LABEL_AREAS, index * 7 + 3)}`;

	return {
		id: labelIdAt(index),
		name,
		hue: hash32(`${shape.seed}:label:${index}`) % 361,
	};
}

export function makeProject(index: number): Project {
	const [key, name] = cycle(PROJECT_NAMES, index);
	const suffix =
		index < PROJECT_NAMES.length ? '' : ` ${Math.floor(index / PROJECT_NAMES.length) + 1}`;

	return {
		id: projectIdAt(index),
		key: `${key}${suffix.trim()}`,
		name: `${name}${suffix}`,
	};
}

/**
 * Strictly decreasing in `index`: issue 0 is the newest. That is what lets `sort=created` page
 * lazily in generation order without ever building or sorting an array.
 */
export function issueCreatedAt(shape: DatasetShape, index: number): number {
	const step = Math.max(HISTORY_SPAN_MS / shape.issues, 1000);
	const rng = createRng(shape.seed, 'issue-time', index);

	return Math.round(DATA_EPOCH - index * step - rng() * step * 0.9);
}

function issueTitle(index: number, rng: () => number): string {
	const component = pick(rng, COMPONENTS);
	const problem = pick(rng, PROBLEMS);
	const context = pick(rng, CONTEXTS);
	const base = `${component} ${problem} ${context}`;

	// One ~300-character title every 500 issues. Deterministic, so a stress case is always a link
	// away rather than something you hope to stumble into.
	if (index % 500 === 3) {
		const long = `${base} — ${DESCRIPTION_BODIES.join(' ')} ${CONTEXTS.join(', ')}`;
		return padToCodePoints(long, 300, ' and it still reproduces after a hard reload');
	}

	if (index % 97 === 5) {
		return `${base}: ${cycle(UNBREAKABLE_NAMES, index).split(' ').join('')}`;
	}

	if (index % 401 === 11) {
		// Leading/trailing whitespace and a zero-width space: trimmed by some renderers, not others.
		return `​  ${base}  `;
	}

	return `${cycle(TITLE_PREFIXES, index)}${base}`;
}

function issueDescription(index: number, rng: () => number): string {
	if (index % 23 === 0) {
		return cycle(BLANK_DESCRIPTIONS, Math.floor(index / 23));
	}

	const paragraphs = [pick(rng, DESCRIPTION_OPENERS), pick(rng, DESCRIPTION_BODIES)];

	if (chance(rng, 0.35)) {
		paragraphs.push(pick(rng, DESCRIPTION_BODIES));
	}

	return paragraphs.join('\n\n');
}

export function makeIssue(shape: DatasetShape, index: number): Issue {
	const rng = createRng(shape.seed, 'issue', index);
	const createdAt = issueCreatedAt(shape, index);

	// Most issues carry 0-3 labels; roughly one in sixteen carries 8 or more, which is what makes
	// row heights genuinely variable rather than variable-in-theory.
	const labelCount = chance(rng, 0.06) ? int(rng, 8, 14) : int(rng, 0, 3);
	const labelIds = distinctInts(rng, labelCount, 0, shape.labels - 1).map(labelIdAt);

	return {
		id: issueIdAt(index),
		key: `BUG-${1000 + index}`,
		title: issueTitle(index, rng),
		description: issueDescription(index, rng),
		status: pick(rng, ISSUE_STATUSES),
		priority: pick(rng, ISSUE_PRIORITIES),
		// ~15% unassigned, so "no assignee" is a first-class state everywhere, not an edge case.
		assigneeId: chance(rng, 0.15) ? null : userIdAt(int(rng, 0, shape.users - 1)),
		reporterId: userIdAt(int(rng, 0, shape.users - 1)),
		labelIds,
		projectId: projectIdAt(int(rng, 0, shape.projects - 1)),
		estimate: chance(rng, 0.35) ? null : pick(rng, [1, 2, 3, 5, 8, 13, 21]),
		createdAt,
		updatedAt: Math.min(createdAt + int(rng, 0, 45) * DAY_MS, DATA_EPOCH),
	};
}

/** Comment count per issue. Mostly quiet, occasionally a 40-comment thread worth paginating. */
export function issueCommentCount(shape: DatasetShape, index: number): number {
	const rng = createRng(shape.seed, 'comment-count', index);

	if (chance(rng, 0.04)) {
		return int(rng, 25, 60);
	}

	return chance(rng, 0.45) ? 0 : int(rng, 1, 5);
}

export function makeComment(
	shape: DatasetShape,
	issue: Issue,
	index: number,
	slot: number,
): Comment {
	const rng = createRng(shape.seed, 'comment', index, slot);
	const authorIndex = int(rng, 0, shape.users - 1);
	const mention = chance(rng, 0.3) ? `@${userIdAt(int(rng, 0, shape.users - 1))} ` : '';
	const id: CommentId = `${COMMENT_ID_PREFIX}${index}-${slot}`;
	// A fixed step plus sub-step jitter, so a thread is strictly ordered by slot without any
	// generator needing to know about the comment before it.
	const step = 6 * 60 * 60 * 1000;

	return {
		id,
		issueId: issue.id,
		authorId: userIdAt(authorIndex),
		body: `${mention}${pick(rng, COMMENT_BODIES)}`,
		createdAt: Math.round(issue.createdAt + (slot + 1) * step + rng() * step * 0.9),
	};
}

/* -------------------------------------------------------------------------------------------- */
/* Memoized accessors                                                                             */
/* -------------------------------------------------------------------------------------------- */

/**
 * Entities are cached in a sparse `Map` bounded by `MEMO_LIMIT`. When the cache fills it is cleared
 * outright rather than evicted one entry at a time: a page scan touches a contiguous run of
 * indices, so wholesale clearing costs one regeneration of the working set and keeps the memory
 * ceiling independent of `?scale=`.
 */
const MEMO_LIMIT = 25_000;

function createMemo<T>(): (index: number, make: (index: number) => T) => T {
	const cache = new Map<number, T>();

	return (index, make) => {
		const cached = cache.get(index);

		if (cached !== undefined) {
			return cached;
		}

		const value = make(index);

		if (cache.size >= MEMO_LIMIT) {
			cache.clear();
		}

		cache.set(index, value);

		return value;
	};
}

export interface DataGenerator {
	shape: DatasetShape;
	user(index: number): User;
	label(index: number): Label;
	project(index: number): Project;
	issue(index: number): Issue;
	/** Deterministic comment thread for a generated issue, oldest first. */
	comments(index: number): readonly Comment[];
	userById(id: UserId): User | null;
	labelById(id: LabelId): Label | null;
	projectById(id: ProjectId): Project | null;
	issueById(id: IssueId): Issue | null;
}

export function createGenerator(shape: DatasetShape): DataGenerator {
	const userMemo = createMemo<User>();
	const labelMemo = createMemo<Label>();
	const projectMemo = createMemo<Project>();
	const issueMemo = createMemo<Issue>();
	const commentMemo = createMemo<readonly Comment[]>();

	const generator: DataGenerator = {
		shape,

		user: (index) => userMemo(index, (i) => makeUser(shape, i)),
		label: (index) => labelMemo(index, (i) => makeLabel(shape, i)),
		project: (index) => projectMemo(index, (i) => makeProject(i)),
		issue: (index) => issueMemo(index, (i) => makeIssue(shape, i)),

		comments: (index) =>
			commentMemo(index, (i) => {
				const issue = generator.issue(i);
				const count = issueCommentCount(shape, i);
				const items: Comment[] = [];

				for (let slot = 0; slot < count; slot += 1) {
					items.push(makeComment(shape, issue, i, slot));
				}

				return items;
			}),

		userById: (id) => {
			const index = parseGeneratedIndex(USER_ID_PREFIX, id);
			return index === null || index >= shape.users ? null : generator.user(index);
		},

		labelById: (id) => {
			const index = parseGeneratedIndex(LABEL_ID_PREFIX, id);
			return index === null || index >= shape.labels ? null : generator.label(index);
		},

		projectById: (id) => {
			const index = parseGeneratedIndex(PROJECT_ID_PREFIX, id);
			return index === null || index >= shape.projects ? null : generator.project(index);
		},

		issueById: (id) => {
			const index = parseGeneratedIndex(ISSUE_ID_PREFIX, id);
			return index === null || index >= shape.issues ? null : generator.issue(index);
		},
	};

	return generator;
}
