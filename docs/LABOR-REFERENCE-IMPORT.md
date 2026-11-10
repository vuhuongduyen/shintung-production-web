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

The source revision includes all application records except the registry itself, append-only admin audit, and active viewers, plus the manifest digest and omissions. Source payloads and outer audit timestamps are checked again in the same atomic D1 batch as the insert. Count guards detect additions/deletions; exact payload guards detect changes without a version increment. An apply-only database snapshot holds the exact payloads; a DB join compares them without retaining payload bindings in the Worker, including Unicode and unchanged-timestamp edits. A failed assertion aborts the transaction; a network failure requires reading/retrying the same key, never assuming either success or failure.

Rollback activation by restoring only the two selector variables to their prior values and deploying the known previous QA version. Keep the unused append-only registry for traceability. Do not delete reports, restore the entire database, or add a registry-delete endpoint. Batch rollback and selector rollback are covered by local synthetic tests; hosted deployment verification remains a separate required step.

## Bounded source validation

Preview remains read-only. It hashes the full existing source scope using SHA-256 with sequential 256KiB pages (one oversized row may occupy its own page). Both scans must match. One heavy request per isolate is retained; competing requests return 503.

Apply creates a uniquely named `_onspa_labor_import_<timestamp>_<random>` transport table and captures the scoped source using CREATE + INSERT SELECT in one D1 batch. Manifest reconstruction and the source digest read only that immutable copy. The approved sourceRevision must match. The final atomic batch checks count plus an exact keyed join of payload, updated_by and updated_at against live app_records, inserts the registry and drops the transport. This detects insert/delete, same-length changes and edits without a timestamp/version increment. All source scope remains checked; no hash function unsupported by D1 is assumed.

No source payload is passed as a commit binding; the previous 40MiB guard-set limit is no longer applicable because that allocation no longer exists. There is no increased cap and no skipped guard. Capture/validation failure leaves no registry; final-batch failure rolls back the insert and drop. A finally block cleans transport on normal failures. Interrupted requests can leave a table; a subsequent authorized apply removes at most ten exact-namespace tables older than 24 hours. Active transports are excluded from full-backup schema and rows; business tables, including similar nonmatching names, remain included. No automatic startup, preview write, source update or configuration activation occurs.

This adds transient DB writes and storage during apply, unlike preview. Deployment must account for that lifecycle. It does not use TEMP tables or add triggers to business writes. Limits still include available DB storage, SQL execution time and request query budget; resource failure must stop the operation and be read back, not prompt source trimming. D1 batch rollback semantics: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch .

SourceRevision now uses `db-snapshot-source-v3`: obtain a fresh preview after deployment. The manifest format is unchanged. Synthetic scale tests cover 16,197 records, 139 bases and over 40MiB of payload in actual bundled workerd, plus a bounded Node worker and conservative 1,000-query budget. Measured Node heap/external allocations are not exact hosted isolate accounting. Hosted preview/apply/readback and all agreed data comparisons remain required before acceptance.

The Admin UI retains the clear non-JSON/invalid-JSON resource/readback error and explicit approval. It never auto-applies or claims success after a failed response.
