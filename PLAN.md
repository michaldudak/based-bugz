# Implementation plan

Sequence for building Based Bugz. `AGENTS.md` holds the agreements and the reasoning; this file
holds the order of work and what "done" means at each step. Update it as phases land.

**Current state:** Phases 0–8 landed. The app is a working tracker: sign in, browse/filter/sort
10,000 issues, create, edit inline, comment, delete with undo, ⌘K over everything, plus the design
system gallery, the combobox lab, the stress lab, a perf overlay and a Playwright parity suite.
Only Phase 9 (canary implementations) remains, and it is blocked on the PR URLs.

The parity suite is **deliberately red in five places**. Each failure is a reproduced defect, not a
flaky assertion, and no assertion was softened to make the baseline green — see
"Known baseline failures" below. That red is the number the three PRs are competing against.

**Strategy:** build the whole app against `impls/baseline` — stable `@base-ui/react` + TanStack
Virtual, wired as the docs describe. That is the control the three PRs must beat, it needs no canary
builds, and it is unblocked by the GitHub outage. When the PR URLs arrive, the app is already a
working harness and each canary is a drop-in.

---

## Scope of v1

A tracker you can actually work in: sign in, browse 10k issues, filter them, open one, edit it,
comment on it, create and delete issues, and have your edits still be there tomorrow.

- **Auth** — fake login, session persisted, protected routes, current user drives "assigned to me",
  comment authorship, and activity attribution.
- **Issues list** — virtualized, filterable, sortable, multi-select with bulk actions.
- **Issue detail** — inline editing of every field, comments with `@mention`, activity log.
- **CRUD** — create dialog, inline updates, delete with confirmation and undo.
- **Command palette** — ⌘K over issues, users, and commands.
- **Settings** — the URL control surface (`?theme=` `?density=` `?dir=` `?scale=` `?seed=`
  `?latency=` `?errorRate=`) exposed as UI.
- **Lab** — stress routes, ds gallery, perf overlay, Playwright parity spec.

### Out of scope for v1

Board/kanban view (Base UI ships no drag-and-drop, so it would test nothing), notifications,
multi-project navigation beyond a project field on issues, real auth, SSR.

### Assumptions

- The signed-in user matters — "Assigned to me" filtering, comment authorship, activity entries. A
  logout/switch-user control is part of the shell.
- Projects and milestones exist as issue fields to give the pickers something to group by, but get
  no dedicated management UI.
- Default scale: 5k users, 10k issues, 200 labels, ~20k palette entries.

---

## Phases

Each phase ends with something you can look at and use. Sizes are relative, not calendar estimates.

### Phase 0 — Skeleton and toolchain · S

`package.json`, `vite.config.ts` (path aliases, `resolve.dedupe` for react), `tsconfig.json`
(`erasableSyntaxOnly`, `verbatimModuleSyntax`, `moduleResolution: bundler`), `index.html`,
`.editorconfig`, `.prettierrc.json`, `.oxlintrc.json` (all layer-boundary overrides written up front,
before the directories they guard exist), `.stylelintrc.json`, `.gitignore`, `src/main.tsx`,
`src/app/config.ts`.

**Done when:** `pnpm dev` serves a page; `pnpm lint`, `pnpm typecheck`, and `pnpm format --check`
all pass. First commit. Running `pnpm format` will retab the existing markdown — expected.

### Phase 1 — Data layer · M

`src/data/`: `types.ts` (union types, no enums), `rng.ts` (seeded PRNG), `generate.ts` (pure
`(seed, index) → entity`, hostile string pools), `repository.ts` (the interface), `in-memory.ts`,
`event-log.ts`, `persistence.ts`, `params.ts`, `provider.tsx`.

Filtering, sorting, and pagination all happen **inside the repository**. A component that filters a
full array client-side has stopped testing anything.

**Done when:** a scratch lab route pages through users with simulated latency and abort; `?seed=`
changes data deterministically; `?scale=100000` boots instantly (nothing materializes the dataset);
writes survive reload; `?fresh=1` resets.

### Phase 2 — Design system foundations · L

`src/ds/`: `tokens.css` (primitive scale → semantic aliases, light + dark), `reset.css`, theme
provider, then Button, Input, Field, Checkbox, Select, Menu, Dialog, AlertDialog, Tooltip, Toast,
Tabs, Badge, Avatar, Separator, Kbd.

**Done when:** `/lab/ds` renders every component in light and dark, both densities, and RTL;
stylelint reports no raw color outside `tokens.css`; each wrapper's line count is noted — the short
ones and the long ones are both findings.

### Phase 3 — App shell and auth · M

Router, providers (QueryClient → RepositoryProvider → ThemeProvider → ToastProvider), sidebar +
topbar layout, `LoginPage`, session in `localStorage`, `RequireAuth`, `SettingsPage`.

Fake auth: email must match a seeded user, any password accepted. A "sign in as random user"
shortcut for speed.

**Done when:** login redirects to `/issues`; reload keeps the session; logout works; a deep link to
`/issues/:id` while signed out returns there after login; settings changes are reflected in the URL
and survive reload.

### Phase 4 — Combobox contract and baseline impl · L

`ds/combobox/types.ts` — the contract, generic over `T`, referencing no Base UI types: async paged
data, grouping, multi-select, create-new, `renderRow`, size estimation, scroll-to-selected, aria
wiring. Plus `slots.tsx` (plain-DOM chips row, group header, empty/loading/error) and
`Combobox.module.css`. Then `impls/baseline/Combobox.tsx` and the lazy `?impl=` resolver.

**Done when:** a lab picker does 5k async users with groups, chips, create-new, scroll-to-selected
on open, full keyboard nav, and correct `aria-setsize` / `aria-posinset`; the build emits a separate
chunk per impl.

### Phase 5 — Issues list · L

`features/issues/`: virtualized list, filter bar (AssigneePicker, LabelPicker, status and priority
selects, text search), sorting, row selection, bulk actions menu, empty/loading/error states.

The issue list uses TanStack Virtual permanently and is **not** part of the evaluation — only the
combobox is. Do not wire it to `impls/`.

**Done when:** 10k issues scroll smoothly in a production build; filters compose and round-trip
through the URL; sorting works with cursor pagination; bulk actions apply to a selection.

### Phase 6 — CRUD · L

Create dialog, issue detail with tabs, inline field editors, comments with `@mention`, delete via
AlertDialog with undo toast, optimistic mutations reconciling against the repository.

**Done when:** create / edit / delete round-trip through the event log and survive reload; undo
restores; the activity tab renders from the log; with `?errorRate=0.2` optimistic updates roll back
visibly rather than silently.

### Phase 7 — Command palette · M

⌘K over issues, users, and commands — mixed result types, sectioned, heterogeneous row heights.

**Done when:** it opens from anywhere, searches 20k+ entries with keyboard nav, and executes actions.

### Phase 8 — Lab, instrumentation, Playwright · M

Stress routes (100k items, variable heights, RTL, nested-in-dialog, 200% zoom), perf overlay
(Performance API event timing + long animation frames, off by default, works in production builds),
Playwright keyboard-parity spec parameterized over `?impl=`, axe scan per impl route.

**Done when:** the parity spec passes against `?impl=baseline` and produces a readable per-impl
report — that report is the template the canaries get judged in.

### Phase 9 — Canary readiness · S · blocked on GitHub

Three aliased installs, `pnpm why` verification that react dedupes and Base UI internals do not
hoist into one shared copy, `impls/pr-a|b|c` scaffolds against the existing contract, and pure-canary
lab routes for rule 12 repros.

---

## Loading strategies

`?people=paged` (default) and `?people=eager` are both wired through `features/people`, switchable
from Settings without a reload. See AGENTS.md — "Loading strategy is a second axis" for what each
one stresses and the measured cost of both.

## Known baseline failures

`pnpm test:e2e` — 11 pass, 5 fail against `impls/baseline`. All five are defects in the documented
Base UI + TanStack Virtual pairing, reproduced in the production preview build:

1. **Tab does not dismiss the popup — focus lands inside it.** The documented composition makes the
   app own the scroll container; that `<div>` is scrollable with no focusable children, so Chrome
   makes it a tab stop. Focus goes input → scroll div and never leaves, so dismiss-on-focus-out
   never fires. `tabIndex={-1}` fixes it at the cost of keyboard scrolling — a real API question.
2. **PageUp/PageDown do nothing.** No handler exists in the combobox path; `PAGE_UP`/`PAGE_DOWN`
   live only in `internals/composite` (Menu/Select/Toolbar). Home/End correctly drive the caret.
   3–5. **`aria-hidden-focus` (×3 cases).** With the popup open, Base UI sets `aria-hidden="true"` on
   the topbar, sidebar and page body but applies `inert` nowhere, leaving ~19 focusable elements
   reachable inside an aria-hidden subtree.

Also observed and not yet resolved:

- **`flushSync` warning on every arrow key.** Base UI calls `onItemHighlighted` inside a React
  lifecycle; TanStack Virtual's `scrollToIndex` calls `flushSync` on a sync range change. The most
  basic keyboard interaction in the documented pairing warns once per keypress.
- **Single-select echoes its own selection back as a query.** The contract controls `inputValue`,
  so on close Base UI pushes the selected label through `onInputValueChange` — which arrives as
  `onQueryChange`, and the app re-queries the server for the thing it just selected. `onQueryChange`
  drops Base UI's `eventDetails.reason`, so app code cannot tell typing from an echo.
- **The popup is ~10px narrower than its control**, because `--anchor-width` measures
  `Combobox.Input` while the visible control is `Combobox.Chips` with border and padding.

## Things that will be subtle

- **Cursor pagination + sorting + optimistic updates** interact badly if the cursor is a bare index.
  Encode the sort key in the cursor from the start.
- **Event log replay across `seed`/`scale` changes** — the log is keyed by `(seed, scale)`, and
  replay drops events referencing entities that no longer exist rather than throwing.
- **Optimistic updates against a paginated cache** — TanStack Query's `keepPreviousData` and
  cursor pages need a deliberate invalidation strategy, decided once in Phase 6 and reused.
- **Measurement and animation** — popup enter animations must not scale a surface containing a
  measuring virtualizer (AGENTS.md, Appearance).
- **The perf overlay must not perturb what it measures.** Sample, don't subscribe to everything.
