# Based Bugz

A deliberately realistic issue tracker, built to find out how [Base UI](https://base-ui.com)
components hold up in an app someone actually uses.

Demos make components look fine. Real apps have 10,000 issues, a hostile dataset, an assignee picker
over 5,000 people that has to stay responsive while the network is slow, and a user who navigates by
keyboard. This app exists to surface the difference.

Its first job is comparing three competing approaches to Combobox virtualization — installed side by
side and swappable at runtime — against the currently documented approach. After that it stays
around as the testing ground for whatever component comes next.

## Stack

Vite · React 19 · TypeScript 7 · CSS Modules · `@base-ui/react` · TanStack Query & Virtual

## Getting started

```bash
pnpm install
pnpm dev
```

Useful URL parameters once it runs: `?impl=` picks the virtualization implementation, `?seed=` and
`?scale=` control the generated data, `?latency=` and `?errorRate=` shape the fake network,
`?theme=` `?density=` `?dir=` cover appearance. Any run is reproducible from its link.

## Deployment

Cloudflare Pages deploys `master` and every pull request automatically. The live site is at
[based-bugz.pages.dev](https://based-bugz.pages.dev/).

## Documentation

- **`AGENTS.md`** — architecture, evaluation rules, and the reasoning behind them. Read before
  changing anything structural.
- **`PLAN.md`** — implementation sequence and current progress.

## License

MIT © Michał Dudak
