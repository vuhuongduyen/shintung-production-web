# Admin QA interface for a reviewed labor-reference snapshot

After deploying this change to QA, sign in with an existing Admin account without a Line restriction. Open **Admin → Căn cứ Giờ công QA** (the collapsible panel above the Admin content).

1. Choose the private JSON **preview request package** containing `action: "preview"`, `manifest`, and `omissions`. This is the reviewed package, not an arbitrary database export or the standalone manifest. Reading the file performs no request and no write. The panel shows its filename, number of bases, and number of omissions. It does not store the file in browser storage or upload it as an attachment.
2. Click **Kiểm tra căn cứ**. The existing authenticated importer validates the manifest digest, source identity/version, and current rate history. The UI enables confirmation only when the returned digest, count, and source revision match the selected package. An existing identical registry is read back and reported without enabling another save.
3. Check the explicit confirmation for the displayed number of bases, then click **Lưu bản căn cứ riêng**. The button is disabled until preview and confirmation are complete; an in-flight lock also prevents duplicate submissions. Selecting another file discards the preview and confirmation. Changing the signed-in account remounts the panel.
4. The UI uses the preview's exact sourceRevision/digest for apply, then performs another read-only preview to verify the stored registry. Success is shown only when this readback matches. If a response is lost, click **Kiểm tra căn cứ** to read back before retrying. Source changes require a fresh preview; no automatic retry or auto-apply occurs.
5. Continue the separately authorized configuration/deployment verification. This panel never changes configuration or activates the registry. It only calls the existing importer through the application's normal session-aware API client; it requires no copied cookies, browser console scripts, or additional credential.

The panel is hidden outside the fixed QA hostname and for non-Admin/Line-scoped sessions. The existing server checks remain authoritative. No permission, QA isolation guard, source report, rate, or generic records allowlist is changed. The generic API can handle reviewed manifests of different sizes; the UI shows the actual selected and server-verified count rather than embedding private production records.

Mounted end-to-end tests use synthetic reports and the real site API with isolated D1 TEST: file selection → preview → explicit confirmation → apply → readback, idempotency, stale source, invalid digest/file, unknown network result, bad readback and UI access restrictions. They do not certify hosted QA until deployment and the agreed hosted checks finish.

---

# Import a reviewed labor-reference snapshot on QA

`POST /api/labor-reference-snapshot-import` uses the existing server-authenticated Admin session, without a Line restriction. It accepts same-origin JSON only. The handler rejects every hostname except the fixed QA hostname; it does not change authentication, permissions, reporting guards, or the generic records allowlist. It has no automatic startup/import behavior.

The operator supplies a privately reviewed `labor-reference-snapshot-v1` manifest and the explicitly approved omissions. Do not commit business manifests, report identifiers, source exports, or session cookies.

1. Deploy the tested code to QA through the existing deployment procedure, preserving QA guards. Leave the snapshot selector unset during preparation.
2. Send `{action:"preview", manifest, omissions}` using an authenticated QA Admin session. This performs reads only. It reconstructs the candidate from current reports, preserved history, and rate versions, and returns `sourceRevision`, `digest`, and counts. A stale or altered manifest is rejected; regenerate and review it rather than overriding the check.
3. Obtain approval for the append operation against that reviewed digest and source revision. Send `{action:"apply", manifest, omissions, expectedSourceRevision:preview.sourceRevision, confirmDigest:preview.digest}`. Do not call apply while awaiting approval.
4. Success returns `stored` or `already-present` and `activated:false`. Exactly one `app_records` row is added with entity `production_labor_reference_snapshot`, key equal to the manifest digest, and the authenticated operator/time in its audit columns. Existing records are never updated or replaced. A conflicting key is rejected. A retry of an identical stored manifest is a no-op, even if live rates have subsequently changed.
5. Only after successful readback and separate configuration approval, select the digest with `LABOR_RATE_SNAPSHOT_ID` and the approved omissions with `LABOR_RATE_OMISSIONS_JSON`, then deploy with the new environment revision. The importer does not set either variable. Verify the active source/environment revision and the full agreed data/UI checklist.

The source revision includes all application records except the registry itself, append-only admin audit, and active viewers, plus the manifest digest and omissions. Source payloads and outer audit timestamps are checked again in the same atomic D1 batch as the insert. Count guards detect additions/deletions; exact payload guards detect changes without a version increment. JSON pages and byte slices bound individual bindings, including large Unicode records. A failed assertion aborts the transaction; a network failure requires reading/retrying the same key, never assuming either success or failure.

Rollback activation by restoring only the two selector variables to their prior values and deploying the known previous QA version. Keep the unused append-only registry for traceability. Do not delete reports, restore the entire database, or add a registry-delete endpoint. Batch rollback and selector rollback are covered by local synthetic tests; hosted deployment verification remains a separate required step.
