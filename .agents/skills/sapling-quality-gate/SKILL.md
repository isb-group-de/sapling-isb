---
name: sapling-quality-gate
description: Clean up and structurally organize Sapling, split oversized files, eliminate inline CSS and duplicate styling, run and repair the complete frontend and backend quality gate including test code, then report source size totals. Use when Sapling changes must be cleaned up, verified, made merge-ready, or made release-ready.
---

# Sapling Quality Gate

Run this as a fix-and-verify workflow from the Sapling repository root. Do not stop at reporting failures when they can be repaired within the requested work.

## Eliminate Inline CSS and Consolidate Styling

Treat frontend styling cleanup as part of the quality gate, not as an optional refactor. Inspect the entire frontend source tree for inline CSS in templates and components, including HTML `style` attributes, framework style bindings or objects, and component-local `<style>` blocks. Remove all such inline or component-local CSS and move the declarations into the frontend's framework CSS files. Prefer an appropriate existing stylesheet; create a clearly scoped framework stylesheet only when no existing file is a coherent home for the rules, and ensure it is imported through the project's normal stylesheet entry point.

Preserve dynamic presentation by expressing state through semantic classes, modifier classes, data attributes, or CSS custom properties defined and consumed by framework CSS. Do not retain inline declarations merely because their values are conditional or computed. Keep behavior, responsiveness, theming, specificity, and visual appearance intact.

Before adding or moving a rule, search the existing stylesheets for equivalent or overlapping declarations, selectors, utilities, variables, and responsive variants. Reuse or extend the canonical rule when possible. Consolidate duplicates within and across CSS files, including duplicate media-query rules and declarations that differ only trivially. When selectors, classes, variables, stylesheet paths, or imports are merged or renamed, update every usage throughout implementation code, templates, tests, stories, and other maintained project files. Remove rules, imports, files, and identifiers that become unused.

Use repository-wide searches to verify the result. Do not declare the cleanup complete while inline CSS, component-local style blocks, duplicate style definitions, stale styling references, or redundant imports remain. If a syntactic match is not actual CSS, document why it is intentionally retained rather than changing unrelated data.

## Split Oversized Files into Cohesive Modules

Treat 600 physical lines as the normal maximum for each maintained source or test file. At the start of the workflow and again after all repairs, run [`scripts/file-size-audit.ps1`](scripts/file-size-audit.ps1) from this skill directory with the Sapling repository root passed through `-RepositoryRoot`. Supplement its results if the repository contains maintained source formats or locations outside the script's defaults.

For every file above 600 lines, inspect its responsibilities and split it along real architectural boundaries. Extract cohesive modules, services, composables, utilities, components, fixtures, or focused subclasses as appropriate to the language and framework. A class that has accumulated separate responsibilities should be decomposed rather than merely moved intact into another oversized file. Preserve public behavior and intentional APIs, update imports, exports, dependency wiring, references, mocks, and tests everywhere, and add or adapt tests where the new boundaries warrant them.

Do not satisfy the limit through arbitrary chunks, cosmetic whitespace or comment removal, regions, re-export indirection with no separation of responsibility, minification, or weakened tests. Avoid creating many tiny modules that obscure a concept that is easier to understand as one cohesive unit.

A file may remain above 600 lines only when keeping it together has a concrete technical or conceptual advantage that outweighs the maintenance cost and a split would materially reduce clarity, correctness, or generated compatibility. Treat generated, vendored, lock, snapshot, and build-output files as outside this refactoring rule. Do not assume that legacy age or refactoring effort alone is a sufficient exception. Record every remaining maintained file above the threshold, its final line count, and its specific justification in the report.

## Organize Related Files into Appropriate Directories

Review the backend and frontend directory trees independently of the 600-line audit. Move related maintained files into clear, appropriately named subdirectories when their current placement scatters one feature, domain, or responsibility across a broad or cluttered folder. Organize components together with their focused composables, services, utilities, styles, fixtures, and tests when that matches the repository's established convention. Apply the same principle to backend controllers, services, models, integrations, and tests. Prefer the dominant existing architecture and naming patterns over introducing an incompatible parallel hierarchy.

Choose directory boundaries that communicate ownership and make related code easy to discover. Keep genuinely cross-cutting code in an established shared location only when it has multiple real consumers; do not turn `common`, `shared`, `utils`, or similarly generic folders into dumping grounds. Avoid unnecessary nesting, single-file directories with no clear growth or ownership benefit, and moves that merely make the tree look different without improving cohesion.

After every move, update all static and dynamic imports, exports and barrel files, path aliases, route or dependency registration, glob-based discovery, mocks, fixtures, tests, stories, stylesheet imports, and other maintained references. Preserve intentional public module entry points where consumers depend on them, but remove obsolete forwarding files, stale exports, and empty directories when they no longer serve a compatibility purpose. Use repository-wide searches to confirm that old paths and identifiers are gone and that similarly named duplicate modules have been consolidated rather than redistributed.

## Guarantee Test-Code Coverage

Before running the gate, inspect the current package scripts and TypeScript, ESLint, Prettier, Jest, and Vitest configuration. Confirm that each formatter, linter, and type-check covers the repository's actual backend and frontend test patterns, including colocated `*.spec.*` and `*.test.*` files and `__tests__` or dedicated test directories.

Use `rg --files` to compare discovered test files with the configured include/exclude patterns. If a default command omits test code, run the appropriate additional project-local command or correct the project configuration when that is within the task's scope. Never claim the gate is clean unless production code and test code were both formatted, linted, and type-checked.

## Run the Full Gate

Run each command separately and in this order so failures remain attributable:

1. Backend Prettier: `npm run format --prefix backend`
2. Frontend Prettier: `npm run format --prefix frontend`
3. Backend type-check: `npm run type-check:backend`
4. Frontend type-check: `npm run type-check:frontend`
5. Backend ESLint: `npm run lint --prefix backend -- --max-warnings=0`
6. Frontend ESLint: `npm run lint --prefix frontend`
7. All backend tests: `npm run test:backend`
8. All frontend tests: `npm run test:frontend`

Do not replace the complete backend or frontend test commands with targeted tests. Targeted tests may be used while diagnosing a failure, but the final gate must run both entire suites.

## Repair Until Clean

Treat every error and warning produced by the gate as a defect to investigate. Fix all actionable causes in implementation code, tests, and relevant configuration. Preserve the intended behavior and test strength; do not make the gate pass by disabling rules, weakening compiler settings, deleting or skipping tests, reducing assertions, or adding blanket suppressions.

After any repair, restart the ordered gate at formatting. Finish only after one complete final pass has:

- zero formatting failures;
- zero type-check errors in production and test code;
- zero ESLint errors or warnings in production and test code; and
- all backend and frontend tests passing.

If a failure is genuinely caused by unavailable external infrastructure, credentials, or another condition outside the authorized scope, fix everything else that is actionable and report the exact remaining command, failure, and required external condition. Do not present a partial run as successful.

## Measure Source Size

After the gate, always run [`scripts/source-stats.ps1`](scripts/source-stats.ps1) from this skill directory and pass the Sapling repository root through `-RepositoryRoot`. Run it even when an external blocker prevents a completely clean gate.

The script runs `sloc` against only `backend/src` and `frontend/src`. It prefers an installed `sloc` command and otherwise uses `npx --yes sloc`. Report its backend, frontend, and combined totals for:

- source files analyzed by `sloc`; and
- source lines reported by `sloc`, excluding blank and comment-only lines.

Do not include `node_modules`, generated build output, coverage output, or files outside those two source directories. Do not substitute repository-wide Git statistics for these scoped values.

## Report

Summarize the repairs made and list the final result of all eight commands. Describe the directory and module boundaries that were improved, the related files that were moved together, and any intentional public entry points that were preserved. List the oversized files that were decomposed and their new logical boundaries. Explicitly confirm that no maintained source or test file exceeds 600 physical lines, or list every justified exception with its final line count and concrete reason. Confirm that inline and component-local CSS was eliminated, styling was consolidated into the framework stylesheets, duplicate rules and stale references were removed, and all affected usages were updated; otherwise identify the exact remaining exception or blocker. Also state that test files were included in formatting, linting, and type-checking, or identify any unresolved coverage gap or external blocker. Always include the `sloc` statistics with separate backend, frontend, and total file and source-line counts.
