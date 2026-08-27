# Bob Project Rules — AI Launch Vehicle Configurator

These rules apply to all Bob sessions in this repository and define how Bob should
behave when assisting with this project.

---

## Code style

- All source files are TypeScript; never introduce plain `.js` files under `src/`.
- Follow the existing import order: Node built-ins → third-party → `@/lib` → `@/components`.
- Keep API route handlers thin — business logic lives in `src/lib/`, not in `src/app/api/`.
- Do not add `console.log` statements to production code; use `console.error` only for
  genuine error paths.

## AI pipeline conventions

- The parse → filter → rank → explain pipeline is the canonical data flow.
  Do not short-circuit or reorder steps without an explicit instruction.
- Every AI step (`parser.ts`, `explainer.ts`, `improver.ts`) must have a deterministic
  fallback that works without `GEMINI_API_KEY`.
- Confidence fields must be preserved end-to-end; never drop them in intermediate
  transformations.

## Catalog

- `data/catalog.json` is the single source of truth for launch vehicle data.
  Do not hardcode vehicle details anywhere in `src/`.
- Any new catalog entry must also pass `data/catalog.schema.json` validation.

## Testing

- New business-logic functions in `src/lib/` require corresponding Jest tests in
  `src/__tests__/`.
- Tests must cover the fallback path (no API key) as well as the happy path.
- Do not mock `fetch` globally; mock only the specific module under test.

## Documentation

- Keep `README.md` accurate when routes or pipeline steps change.
- The `launch-vehicle-configurator-plan.md` build log should be updated when
  a significant feature is added or changed.

## Commit hygiene

- Prefix commit messages with `[bob]` when the commit contains code primarily
  generated or substantially modified by Bob during a session.
- Keep commits small and focused on a single logical change.
