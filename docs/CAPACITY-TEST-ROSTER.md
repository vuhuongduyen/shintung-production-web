# Synthetic Capacity roster: integration contract

## Scope and current status

This PR supplies a dormant component and a guarded backend seam. It does **not** activate a live testing mode. Existing `worker/site-api.mjs` and local API calls intentionally remain unchanged. A normal application response has no `testRoster` capability and displays no selector. No Site ID, host allowlist, employee runtime IDs, environment flag, credential or employee data is committed here.

The QA deployment's existing source/guard must be retrieved and verified before wiring this seam. That source was not available during this implementation. Do not bypass a denied source-sync route, guess guard names, loosen permissions or infer isolation from an environment variable. Activation, merge and deployment remain separate approval/verification gates.

## Server integration, only in the isolated QA overlay

1. Verify the exact QA Site, source revision, isolated DB/FILES, disabled external integrations and existing request guard. Preserve the overlay outside the application diff promoted to MAIN.
2. Select an already-prepared **existing** draft test week and one Line. Confirm no affected real schedules, reports, allocation reservations or employee history. This feature cannot create a week or migrate old schedules. Preparing any missing test records needs its own authorized workflow.
3. Supply a server-owned policy `{week, line, employeeIds}` containing only the explicitly approved synthetic directory IDs. IDs must use the `QAOT` prefix and names the `SYNTHETIC QA OT` label, but labels alone are not authorization. Check exact directory provenance before configuring the allowlist. Never build a policy from request body/query, a browser flag, or all matching employee names.
4. For the approved week, call `readCapacity(db, week, actor, policy)`. If the overlay uses `readLatestCapacity`, decorate its matching snapshot with `withTestRosterCapability(snapshot, policy)` as well. Do not decorate unrelated weeks. The original authenticated actor and existing permissions remain mandatory.
5. Route **every mutation** for the scoped test week through `mutateCapacity(db, body, actor, clock, policy)`, including save/confirm/sync/review/revoke. Do not pass a browser-controlled clock or skip the existing authentication/integration guards. Bind the policy from the target week, not a client opt-in field; an omitted client field must not disable server validation.
6. Preserve all other QA guards for employees, allocation, production workflow, attendance, payroll, exports and integrations. This Capacity seam is not a universal synthetic-data sandbox. Do not activate unless those downstream write paths retain their existing restrictions and their scoped test inputs have been verified.
7. Keep this activation/configuration out of MAIN. Removing the UI capability alone is not a rollback of saved data. Do not delete records or recompute history as part of source rollback.

## Behavior and deliberate restrictions

- The selector replaces all seven days' HC/OT and dormant `savedHc` arrays explicitly, without automatically saving. Each date includes only selected employees employed on that date; a future employee is eligible for the future test day even if inactive today.
- Normal HC off/on and TC enable then use only the selected roster. No directory editing/import, backdated employment edit, background seed or automatic data reset occurs.
- Only a never-confirmed draft can replace its roster. Existing leave/other-time/cleaning/transfer entries are not silently removed. Server validation applies the same preservation rule to direct requests.
- The conservative guard blocks *any* roster change while prior dependency entries exist, including toggling HC/TC after adding leave. Configure roster/working days/TC first. Handle dependencies explicitly and separately; never erase historical entries to make a test pass.
- Capacity cleaning and transfers are out of this narrow test scope. Named synthetic leave is supported. Existing unrelated Lines remain byte-equivalent within the saved week.
- The allowlist is not persisted in Capacity or exposed as new user permissions. Existing lifecycle, permissions and concurrent-write errors still apply.

## Verification checklist

Before merge: run new unit, mounted-component and isolated D1 tests; Capacity/workday/transfer/cleaning regressions; CI contracts, TypeScript and build; inspect lint findings and full CI on exact PR head/merge tree.

Before QA activation: record source/overlay manifest and full related-data baseline. Verify no policy/capability on MAIN or unrelated weeks. Test unauthenticated/read-only requests, forged employee IDs, expired employment dates, stale revisions, unchanged other Line/directory, and confirm existing-week guard. Test matching policy in both normal and latest cached reads and after Save/reload.

On QA after authorized activation: use only synthetic records, set HC/TC before leave, Save → reload → confirm → sync → review, and verify actual schedule/attendance/overtime/payroll on the same scoped employees. Compare all related pre-existing records and calculations before/after. Include repeated Apply, Clear, disabled/read-only state, switching week/Line, revision refresh, cancel/navigation and desktop/mobile checks. Component tests are not browser acceptance.

Do not claim the overtime end-to-end workflow complete until these live checks pass and the user accepts the result. Do not deploy MAIN as part of this work.
