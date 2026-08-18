# Based Bugz

A realistic issue tracker used as a testbed for Base UI components. It is **not** a demo gallery —
it is a product you can actually use, because the pains worth finding are the ones you hit on day
two of using your own app, not the ones you think to write a test for.

First evaluation target: three competing Combobox virtualization APIs from unmerged Base UI PRs,
compared against the currently documented approach. Long term this app hosts evaluations of other
Base UI components too, so **nothing may be named or structured around virtualization**.

---

## Stack

| Concern                   | Choice                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Build                     | Vite 8                                                                                                   |
| UI                        | React 19.2 (no React Compiler — see Evaluation rules)                                                    |
| Language                  | TypeScript 7 (`typescript@7` on `latest`; Vite never typechecks, so `tsc --noEmit` is a separate script) |
| Components                | `@base-ui/react` 1.7 — note the package name, **not** `@base-ui-components/react`                        |
| Styling                   | CSS Modules + CSS custom properties. No CSS-in-JS, no Tailwind, no other component library.              |
| Data                      | TanStack Query 5 over a repository interface                                                             |
| Virtualization (baseline) | TanStack Virtual 3                                                                                       |
| Routing                   | React Router 8, declarative                                                                              |
| Package manager           | pnpm                                                                                                     |

Do not add dependencies beyond this list without asking. Every extra library is a confounder in a
comparison whose whole point is how much code an API makes you write.

TypeScript config: `erasableSyntaxOnly` + `verbatimModuleSyntax` (so no enums, namespaces, or
parameter properties) and `moduleResolution: bundler`.

---

## Layout

```
src/
  app/          # providers, routes, layout, config.ts (product name lives here)
  ds/           # design system: app-agnostic wrappers over @base-ui/react
  features/     # domain components: pickers, issue list, issue detail, command palette
  impls/        # virtualization strategies: baseline, pr-a, pr-b, pr-c
  data/         # repository interface, in-memory implementation, seeded generator
  lab/          # stress routes + a ds gallery (no Storybook)
```

### Import rules

These are the load-bearing part of the architecture. Breaking one silently invalidates the
evaluation, so treat them as build errors even before a lint rule enforces them.

- `ds/` imports `@base-ui/react`, tokens, and its own CSS. It must **not** import `features/`,
  `data/`, or any domain type. Everything in `ds/` is generic.
- `features/` imports `ds/` and `data/`. It must **not** import from `impls/` — it reaches
  virtualization only through `ds/combobox`.
- `impls/` imports its own aliased Base UI build, a virtualization library, and the contract types
  and CSS from `ds/combobox`. It must **not** import `features/` or `data/`, and it is **generic over
  `T`** — an impl that knows what a `User` is has already cheated.
- Only `data/` constructs `InMemoryRepository`. App code sees the `Repository` interface via context.

---

## Evaluation rules

Non-negotiable. Each exists to stop a specific way the comparison could quietly become meaningless.

1. **Contracts are driven by the app's requirements, never weakened to what an implementation can
   express.** If a PR's API can't satisfy a contract, that is the headline finding — not a reason to
   soften the contract. Contract types in `ds/combobox/types.ts` reference no Base UI types — four
   different package instances must be able to satisfy them.
2. **Implementations compose their own package's Combobox parts** and own scroll container,
   measurement, and index math. Nothing else. `ds/combobox` supplies the contract types, the CSS
   Modules, and plain-DOM slot components (chips row, group headers, empty / loading / error
   states); impls apply those classNames to their own parts, and row renderers are passed down from
   `features/`. A shared shell must **not** render Base UI parts itself: parts from different
   aliased packages carry distinct React context objects, so a stable `<Combobox.Input>` under a
   canary Root would fail to connect — or worse, half-work.
3. **Every repository read is async, abortable, and cursor-paginated**, even though the data is an
   in-memory array. The moment one picker gets a synchronous array, that picker stops testing
   anything. `?people=eager` does **not** weaken this: the repository stays async and paged, and
   eager loading is built on top of it by draining every page once. The picker ends up holding a
   complete local array — which is a loading strategy, not a shortcut through the repository.
4. **`Page.total` is optional.** Whether an API demands a known item count upfront is a primary
   differentiator; making the count optional forces the question instead of hiding it.
5. **No React Compiler.** It rewrites memoization, which is the axis under comparison.
6. **No `useDeferredValue` / `startTransition` in the filter path** initially. It is the standard way
   to paper over a slow list. Add it later as a deliberate second axis.
7. **StrictMode on in dev; perf conclusions only from `vite build && vite preview`.** Double-mounting
   catches real measurement-effect bugs, but dev numbers are worthless for comparison.
8. **Accessibility counts toward the verdict** — correct `aria-setsize`, `aria-posinset`, and
   `aria-activedescendant` across a windowed list, plus a VoiceOver pass. Behavior checks that feed
   the verdict run in Chrome, Safari, and Firefox — scroll anchoring, `scrollend`, and momentum
   scrolling differ enough between engines to flip a conclusion.
9. **Variable-height rows belong in the core app**, not quarantined in `lab/`. The assignee picker is
   naturally two lines with an avatar, and this is the sharpest differentiator between approaches.
10. **Seeded data must be hostile**: CJK and RTL strings, near-duplicate names, emoji, at least one
    ~300-character title. Deterministic seed, hand-rolled generator — faker produces tastefully
    uniform data that flatters everything. The generator is a pure `(seed, index) → entity`
    function; nothing ever materializes the full dataset, so `?scale=100000` is free at startup and
    pages can be produced on demand.
11. **Instrumentation is off by default.** When the overlay is always on you stop using the app and
    start reading numbers, and the qualitative pain is the part nothing else gives you. It must also
    work in production builds (rule 7 says that's where perf conclusions come from): metrics come
    from the Performance API — event timing, long-animation-frames — not React DevTools. React
    render counts are a dev-only diagnostic, never verdict evidence.
12. **Attributing a bug to a PR requires a pure-canary repro.** In this app a canary Combobox sits
    inside stable-Base-UI surroundings (Dialog, Popover, Toolbar) — a pairing no real user ships.
    Portal stacking, outside-click dismissal, and focus management all coordinate across that
    package boundary, so the aliasing itself can manufacture bugs. Before recording one as a
    finding, reproduce it in a lab route where the surrounding components come from the same canary
    build.

### Loading strategy is a second axis

`?people=` switches how person pickers get their rows, and both settings are real strategies real
apps ship:

- **`paged`** (default) — a page at a time, more requested as the viewport nears the end. Asks
  whether an API copes with a list that grows underneath it and a count it may never learn.
- **`eager`** — every person drained once into memory, then filtered locally. Asks whether it copes
  with a large static array whose result set changes wholesale on every keystroke, with no async
  boundary to hide behind.

Debouncing applies to `paged` only. Eager mode has no network left to protect, and a delay there
would only hide the cost the mode exists to expose — so every keystroke scans the whole array and
rebuilds the row model synchronously, with rule 6 forbidding anything that would soften it.

Measured on the production preview: 5,000 people cost 10–18ms a keystroke with no long animation
frames; 50,000 cost 41–51ms, which is where it starts to be felt. That is the range in which an
API's own filtering would begin to matter, and therefore where the three PRs are most likely to
diverge.

### The baseline is the defending champion

Stable Base UI ships Combobox without built-in virtualization, and the docs point at TanStack
Virtual. So `impls/baseline` — stable Base UI wired to TanStack Virtual exactly as documented — is
the **control**, and it gets built first. It is what users write today. A PR that does not clearly
beat it in app-code terms has not earned its API surface.

### What the verdict is made of

Primary evidence is a diff of `src/impls/*`: how much code each API needs to satisfy identical real
requirements, how much virtualization detail leaks upward, and which requirements an API simply
cannot express. Frame timings are supporting evidence, not the headline.

---

## Design system conventions

`src/ds/` is a record of what every Base UI user has to build for themselves before they can ship.
An 8-line wrapper means the defaults are right; an 80-line one is a library finding worth writing
down, not an app detail to shrug at.

- **Pre-assemble the boring parts, keep the meaningful ones.** `<Dialog>` renders Root + Portal +
  Backdrop + Popup internally and exposes `Dialog.Title` / `Dialog.Actions`. Nobody writes a
  Positioner in feature code — but collapsing Menu to an `items={[]}` prop would throw away the API
  worth exercising.
- **No `render` prop on wrappers, and no replacement escape hatch.** A call site that genuinely needs
  one is a signal: either the wrapper wants a targeted prop, or that one site drops to raw
  `@base-ui/react`. Both outcomes are informative; a universal escape hatch hides the question.
- **Keep Base UI's prop names** (`open`, `onOpenChange`, `disabled`, `nativeButton`). No synonyms.
- **Style off Base UI's `data-*` state attributes**, never conditional classNames.
- One CSS Module per component. Colors, spacing, and radii come from tokens only.

---

## Appearance

Plain, neutral, quiet — shadcn-like, minus Tailwind. shadcn is a visual reference only, never a
code source. The app should look like a tool you'd actually use, and the aesthetics must never
compete with the evaluation for attention.

- **Two-layer tokens** in `ds/tokens.css`: a primitive neutral scale underneath, semantic aliases
  on top (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--ring`,
  `--danger`, …). Components consume semantic tokens only.
- **Dark mode redefines the semantic layer only** — no component has per-theme code. Default
  follows `prefers-color-scheme`; `[data-theme]` on `<html>` overrides it; `?theme=` pins it for
  reproducible runs. Both modes are first-class: every component gets checked in both before it's
  done.
- **The shadcn grammar**: 1px low-contrast borders over shadows, small radii (6–8px), muted
  foreground for secondary text, compact type scale (13–14px base), whitespace over divider lines.
  The accent is near-neutral (dark-on-light / light-on-dark, zinc-style); saturated color is
  reserved for meaning — status, priority, focus, destructive — never decoration.
- **One page frame.** Every route renders `ds/page`, which owns the gutters, the `--page-max`
  content width and the `<h1>`/`<h2>`/`<h3>` sizes. A route picks `contained` or `full` and nothing
  else — four screens each choosing their own max-width and heading size is how a testbed starts
  looking like four testbeds.
- **Heading sizes come from type-role tokens** (`--text-page-title`, `--text-page-subtitle`,
  `--text-section-title`, `--text-subsection-title`), never from the raw `--text-*` scale. A page
  reaching for `--text-xl` directly is the drift, not the fix.
- **Focus is always visible**: `:focus-visible` ring driven by `--ring` on every interactive
  element.
- **Responsive down to 360px.** Not "doesn't break" — genuinely usable. The sidebar collapses to a
  drawer below 768px, the filter bar collapses into a popover rather than overflowing, list rows
  reflow to stacked title + meta, and dialogs go full-bleed on small viewports. Touch targets are at
  least 44px under `@media (pointer: coarse)`. Check every screen at 360×640, 768×1024, and
  1280×800 before calling it done.
- **Small viewports are a virtualization stress case, not just a layout one.** A popup constrained
  by `dvh`, an on-screen keyboard resizing the visual viewport mid-scroll, and momentum scrolling
  all hit measurement code that desktop testing never reaches. Mobile-sized runs count toward the
  verdict.
- **Motion is fast (~120–150ms), opacity/transform only, honors `prefers-reduced-motion`** — and
  popup enter animations must not distort measurement: a popup animating `scale` while a
  virtualizer measures rows yields garbage heights. Position first, then fade; never scale-animate
  a surface that contains a measuring virtualizer.

---

## Code style and tooling

**Tabs. Everywhere.** TS, TSX, CSS, JSON, Markdown. Indent width is the reader's business, not the
file's — which is the same argument this project makes about accessibility generally.

`.editorconfig` is the source of truth for editors: `indent_style = tab`, `indent_size = 2`,
`end_of_line = lf`, `charset = utf-8`, `insert_final_newline = true`, `trim_trailing_whitespace = true`
(disabled for `*.md`, where trailing spaces are meaningful).

**Prettier 3.9** formats everything: `useTabs: true`, `tabWidth: 2` (Prettier still needs a width to
compute `printWidth` wrapping), `printWidth: 100`, `singleQuote: true`, `semi: true`,
`trailingComma: "all"`. Where it doesn't conflict with tabs, keep quote style and print width
aligned with the Base UI repo's own config, so snippets moving between this app and library PRs
don't reformat on paste.

**oxlint 1.78 is the linter, not ESLint.** This is forced, not aesthetic: `typescript-eslint` 8.67
declares `typescript: ">=4.8.4 <6.1.0"` and there is no v9, so it cannot run against TypeScript 7.
oxlint has its own parser and no `typescript` dependency, so the conflict doesn't exist. It also
ships no formatting rules, which means no `eslint-config-prettier` layer to maintain. Revisit ESLint
only if typescript-eslint ships TS 7 support and we actually want type-aware rules — we currently
don't.

Config lives in `.oxlintrc.json`. The rules that matter, all verified working on 2026-08-17:

- **Layer boundaries**, via per-directory `overrides` + `no-restricted-imports` patterns — one
  override block per layer, mirroring the Import rules section above. This is what makes those rules
  enforced rather than aspirational.
- **Canary impls must not import stable `@base-ui/react`.** The highest-value rule in the project: a
  `pr-a` file importing stable Base UI would silently benchmark the wrong package and quietly
  invalidate a comparison. Use `patterns` with `group: ["@base-ui/react", "@base-ui/react/**"]` —
  the exact-name `paths` form misses subpath imports like `@base-ui/react/combobox`, which is how
  every real import in this codebase is written.
- **No cross-impl imports** — `impls/pr-a` must not reach into `impls/pr-b`.
- **`react-hooks/exhaustive-deps`** — non-negotiable given how much measurement logic lives in
  effects.
- **`jsx-a11y`** on our own markup, backing rule 8 at authoring time.
- **Ban `useDeferredValue` / `startTransition`** in `ds/combobox` and the picker features, with a
  message pointing at evaluation rule 6 — otherwise that agreement erodes the first time someone
  makes a list feel faster. (Verify oxlint's `importNames` support when writing the config; fall
  back to `no-restricted-syntax` if absent.)

**stylelint 17** + `stylelint-config-standard` for CSS Modules, plus a rule disallowing raw color
values outside `ds/tokens.css` — that is the "components consume semantic tokens only" agreement,
enforced.

**Scripts**: `lint` (oxlint + stylelint), `format`, `typecheck` (`tsc --noEmit`), `test:e2e`
(Playwright). No pre-commit hooks until git exists, and no CI until there's something to protect.

**Renovate** (`renovate.json5`) opens dependency PRs on the 1st of each month and only then —
related packages are grouped so a month costs a handful of PRs, not a dozen, and anything not yet
PR'd sits on the dependency dashboard issue rather than in your inbox. Two things are deliberately
excluded: `@base-ui/react`, because the pnpm patch is keyed to the exact version and Renovate does
not rewrite `pnpm.patchedDependencies`, and the aliased canary builds, whose pinned PR artifacts are
the evaluation. Never add `pnpmDedupe` to `postUpdateOptions` — deduping is precisely what must not
happen to the canaries' internal siblings.

---

## Conventions

**Product name.** "Based Bugz" everywhere — user-visible UI, package name, docs, directory. It
lives in `src/app/config.ts` and is referenced from the sidebar, page header, and `document.title`,
so renaming stays a one-liner.

**Implementation switching.** Each impl is a lazy `import()`, so Vite emits one chunk per impl and
per-impl bundle size falls out of the build. Switching is a runtime `?impl=` param that remounts the
subtree — no restart, no cross-contaminated state. Canary builds install side by side under distinct
dependency names (`base-ui-a`, `base-ui-b`, `base-ui-c`); `react` and `react-dom` must dedupe to a
single copy, and `@base-ui/react`'s internal siblings must **not** hoist into one shared copy across
impls. Verify with `pnpm why` after any install.

**URL parameters** are the app's control surface, so any run is reproducible from a link:
`?impl=` `?seed=` `?scale=` `?latency=` `?errorRate=` `?density=` `?theme=` `?dir=` `?fresh=`
`?people=`

**Mutations** append to an event log, which serves undo-via-Toast now and replay-to-server later.
The log persists to `localStorage`, keyed by `(seed, scale)`, and replays over freshly generated
data on load — edits surviving a reload is what makes dogfooding real; without it the app resets
every refresh and never stops feeling like a demo. `?fresh=1` (or a reset control) clears the log.
The repository is designed so an `HttpRepository` can replace `InMemoryRepository` with no app
changes.

**Assets are local and deterministic.** Hand-rolled inline SVG icons (no icon dependency),
initials-based avatars derived from the seed (no remote images), system font stack. The app makes
zero runtime network requests, so perf runs are clean and everything works offline.

**Out of scope: SSR.** Client-only by design. Hydration behavior of virtualized listboxes is a real
library question, but it is a separate evaluation with its own harness if it ever matters.

**Testing.** A minimal Playwright keyboard-parity suite is the objective backing for rule 8: one
spec — open, type, arrow up/down, page up/down, home/end, enter, escape, tab-out,
scroll-to-selected-on-open — parameterized over every impl via `?impl=`, run against the production
preview build, plus an axe scan per impl route. It is a parity check, not a test pyramid: the app's
correctness bar stays "you notice when using it"; the suite exists so "impl X breaks keyboard nav"
is a reproducible finding rather than an impression.

---

## Open items

- The three PRs are known and verified installable (2026-08-18): mui/base-ui #5173 (built-in
  `Combobox.Virtualizer`), #5414 (context-only `ListVirtualizer`), #5466 (`Virtualizer` with
  context + props). See PLAN.md Phase 9 for the verified plan, the type-identity hazard and its
  postinstall fix, and the issues-list scope change (it becomes the standalone-virtualizer
  evaluation surface; `@mui/x-virtualizer` is an approved dependency, used only by pr-5173's
  List, the one variant with no standalone story of its own).

See `PLAN.md` for the implementation sequence.
