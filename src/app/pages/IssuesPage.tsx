/**
 * Route entry for `/issues`. The screen itself lives in `features/issues`, which is where domain
 * components belong (AGENTS.md — Layout); this file exists so the router keeps importing one stable
 * path regardless of how the feature is organised internally.
 */

export { IssuesPage } from '@/features/issues';
