# Implementation plan

Sequence for building Based Bugz. `AGENTS.md` holds the agreements and the reasoning; this file
holds the order of work and what "done" means at each step. Update it as phases land.

**Current state:** git initialized (branch `master`), `AGENTS.md` + `CLAUDE.md` written, no code yet.

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
