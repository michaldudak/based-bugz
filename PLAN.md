# Implementation plan

Sequence for building Based Bugz. `AGENTS.md` holds the agreements and the reasoning; this file
holds the order of work and what "done" means at each step. Update it as phases land.

**Current state:** Phases 0–8 landed. The app is a working tracker: sign in, browse/filter/sort
10,000 issues, create, edit inline, comment, delete with undo, ⌘K over everything, plus the design
system gallery, the combobox lab, the stress lab, a perf overlay and a Playwright parity suite.
The three PR URLs are known, canary builds are verified installable side by side, and Phase 9 below
is the verified plan for them. Nothing in it is implemented yet.

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

_(Superseded in Phase 9: the issues list is now the standalone-virtualizer evaluation surface,
reached through the `ds/list` seam. The baseline List keeps the original TanStack code, unchanged,
as the control.)_

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

### Phase 9 — The three candidates · XL · verified feasible, not started

The PRs under evaluation, all in `mui/base-ui`, all alive as of 2026-08-18:

| PR                                                           | API shape                                                                                         | Combobox story                              | Standalone story                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [#5173](https://github.com/mui/base-ui/pull/5173) `91e45e1a` | `<Combobox.Virtualizer>` part backed by `@mui/x-virtualizer`                                      | built-in part                               | **none** — fall back to `@mui/x-virtualizer` directly                                                  |
| [#5414](https://github.com/mui/base-ui/pull/5414) `0181d7b8` | standalone `<ListVirtualizer>` component, **context-only** (throws outside a virtualization host) | drop into `Combobox.List`                   | possible, the hard way: the app publishes its own virtualization host for `ListVirtualizer` to bind to |
| [#5466](https://github.com/mui/base-ui/pull/5466) `a873cbc2` | `<Virtualizer>`, context **and** props API                                                        | drop into `Combobox.List` (context binding) | native: `items` prop + 3-arg renderer                                                                  |

Lineage matters for the diff evidence: #5414 contains #5173's engine unchanged, #5466 contains
#5414. The windowing engine is identical in all three; the public API is the axis. All three canary
builds also depend on `@mui/x-virtualizer ^0.6.0`, so the built-ins and our direct fallback run the
same engine version (0.6.3) from one shared copy — which is what a real install would produce.

**Scope change from the original plan:** the issues list joins the evaluation as the _standalone_
surface (it was previously "TanStack Virtual permanently"). Each implementation now provides two
components — Combobox and List. The registry becomes `{ Combobox, List }` per impl, `?impl=`
switches both, and the baseline keeps its current TanStack code for both surfaces as the control.

| `?impl=`   | Combobox                              | Issues list                                                                           |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `baseline` | stable + TanStack Virtual (unchanged) | TanStack Virtual (extracted from `IssueList`, unchanged behaviour)                    |
| `pr-5173`  | canary `<Combobox.Virtualizer>`       | shared `@mui/x-virtualizer` adapter                                                   |
| `pr-5414`  | canary `<ListVirtualizer>`            | custom host + `<ListVirtualizer>` — the host the app must write is itself the finding |
| `pr-5466`  | canary `<Virtualizer>` (context)      | canary `<Virtualizer items>` (props)                                                  |

The x-virtualizer fallback is needed only by pr-5173 and lives in `impls/pr-5173/List.tsx`. It is
scaffolding to keep the app usable under that impl — not "what #5173's API makes you write" — and
the verdict must not count it as such. The List diff is then genuinely four approaches: TanStack
(baseline), raw x-virtualizer (5173), custom-host + `ListVirtualizer` (5414), `Virtualizer items`
(5466).

**The 5414 standalone path, verified against the canary build:** `ListVirtualizer` binds to two
contexts. A host is a stable object — `componentName`, a registry from
`createListVirtualizationRegistry()`, a consumer-owned `virtualItemContext` its rows read
`data-index`/aria props from — and a reactive `ListVirtualizationListState`:
`{ activeIndex, items, renderAllRows, renderAllRowsRestoreVersion, scrollActiveIntoView }`. A
plain list supplies `activeIndex: null`, `renderAllRows: false`, `scrollActiveIntoView: false` —
three combobox-flavoured fields it must still provide, which is the "not as easy as #5466" cost in
concrete form. **Catch:** these primitives ship in the tarball under `internals/virtualization/`
but the exports map does not cover that path (`ERR_PACKAGE_PATH_NOT_EXPORTED`). The postinstall
script therefore widens `base-ui-5414`'s exports map alongside the version rewrite — same specifier
root as `ListVirtualizer`'s own imports, so context identity is preserved by construction (no Vite
alias tricks). Recorded as a finding either way: standalone use today requires primitives the
package does not export.

#### Verified in a scratch install (2026-08-18)

- `pkg.pr.new` canaries exist for all three PRs; `base-ui-5173|5414|5466` URL aliases install side
  by side with stable, one `react@19.2.8`, four distinct `@base-ui/react` instances, one
  `@mui/x-virtualizer@0.6.3`, one `@base-ui/utils@0.3.2` shared by all four (canaries pin the
  published 0.3.2 — matches a real install; parts contexts live in `@base-ui/react`, not utils).
- Type-check smoke test passes against all four instances simultaneously: `Combobox.Virtualizer`
  on 5173, `ListVirtualizer` generics on 5414, `Virtualizer` context and standalone forms on 5466,
  `useVirtualizer` types from x-virtualizer.
- **Type-identity hazard, found and solved:** all four packages declare `@base-ui/react@1.7.0`, and
  TypeScript dedupes declarations by `name@version` — so every alias silently resolved to stable's
  types and canary-only APIs "didn't exist". Mitigation, verified working: a postinstall script
  rewrites each alias's `package.json` version to `1.7.0-pr<N>`. Runtime is untouched (version
  string only). Corollary: TS will never catch cross-package part mixing (parts accept `ReactNode`
  children), so the oxlint no-stable-imports rule in `impls/pr-*` is the only guard — already in
  place.
- Canary URLs will be pinned by commit sha (`pkg.pr.new/mui/base-ui/@base-ui/react@<sha>`), not PR
  number: `@5173`-style refs float to the latest push, and a comparison whose subject can change
  under it overnight is not a comparison. Bumping the sha is a deliberate, recorded act.

#### Known constraints going in (from the PR descriptions — findings templates, not blockers)

- **#5173:** requires `items` on Root; flat collections only — **no grouping** (our contract has
  `groupOf`, so the grouped parity tests will fail against it: that is rule 1 working, not a bug in
  the harness); virtualizer must be the sole item-rendering child of `List`; each renderer returns
  exactly one `Combobox.Item` (our create-row and loading-row are not Items — adapter friction to
  measure, possibly synthetic entries in `items`).
- **#5414:** same engine; public surface is `children`, `getItemKey`, `estimatedItemHeight`,
  `overscanPx`, `enabled`, `actionsRef`. Throws outside a host.
- **#5466:** adds `items` + `activeIndex` + 3-arg renderer (`aria-posinset`/`aria-setsize`/
  `data-index` for hostless rows). Standalone mode leaves filtering, keyboard nav, selection, and
  `activeIndex` clamping to the consumer — and has no end-reached callback, so infinite paging in
  the issues list is driven by observing the max mounted index from the renderer.

#### Steps

1. **Dependencies + guards · S** — add the three sha-pinned aliases and `@mui/x-virtualizer`;
   postinstall script does the version splitting for all three aliases plus the exports-map
   widening for `base-ui-5414`; `pnpm why` assertions recorded in PLAN.
2. **List seam · M** — `ds/list/` contract (`items`, `itemKey`, `renderItem`,
   `estimateItemHeight`, `onEndReached`, `aria` pass-through; impls own scroll container,
   measurement, index math — mirroring the combobox rules); registry becomes `{ Combobox, List }`;
   extract baseline TanStack list from `features/issues/IssueList.tsx` into `impls/baseline/List.tsx`
   (generic over `T`). **Gate:** app behaves identically, parity suite still 11/5.
3. **pr-5173 Combobox · L** — the most constrained API first, so contract violations surface
   earliest. Pure-canary lab route (rule 12) in the same step.
4. **pr-5173 List · M** — the x-virtualizer fallback, referenced against #5173's internal adapter
   for wiring patterns (its params are grid-shaped: `RowEntry[]`, dimensions, layout).
5. **pr-5414 Combobox + List · L** — the Combobox is mostly #5173's integration with the part
   swapped for the component; the List means writing the virtualization host (registry, two
   context providers, an item context of our own), which is the PR's headline standalone finding.
6. **pr-5466 Combobox + List · L** — both surfaces native; the standalone List is the first real
   test of the props API.
7. **Parity + a11y matrix · M** — the suite already parameterizes over registered impls; add a
   small standalone-list spec (scroll, paging, no layout thrash). Full matrix in Chrome, then the
   Safari/Firefox pass that feeds the verdict (rule 8).
8. **Verdict scaffolding · S** — `FINDINGS.md`: per-impl app-code diff stats, parity/a11y results,
   the constraint list above filled in with what actually happened, frame timings as supporting
   evidence.

Docs to update when step 1 lands: AGENTS.md stack table (`@mui/x-virtualizer` allowed), the
Phase 5 note that the issues list is now an evaluation surface, and the Conventions section
(sha pinning, postinstall script — version splitting plus the 5414 exports-map widening).

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
