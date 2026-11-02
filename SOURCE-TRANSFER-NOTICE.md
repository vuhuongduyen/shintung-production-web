# Authorized private source transfer — ONSPA v807

Origin source commit: 8b22aa8cc69ab9c7d2e9d2e098ccb8923d88c5fe
Destination authorized: private repository vuhuongduyen/shintung-production-web.

This bundle includes source-embedded operational identity mappings (staff names, login IDs and emails) explicitly approved by the owner. Treat as private. No live database export, R2 uploads, backups, secrets, credentials, Git history or deployed build outputs are included. Embedded business baseline JSON and clearly synthetic TEST fixtures are retained because source modules import them; these are not a live production DB snapshot.

Only staged change to original source: two unnecessary phone/mobile literals in app/page.tsx embedded initialSystemUsers are blanked. Original checkout and deployed site were not changed. This bundle is therefore NOT byte-identical to the origin commit. It is not a deployment instruction. Preserve the current Site project ID and DB/FILES bindings; do not create a replacement Site. Do not merge or deploy as part of source synchronization.

Historical operational docs/results are excluded, as are generated archives and prior provenance reports. Tests that require omitted docs may need those documentation inputs separately. Existing backup-generation scripts are source only: do not run them merely to transfer this bundle. No full build/typecheck was run during packaging; consumer must validate before any authorized implementation/deployment.

SOURCE-TRANSFER-MANIFEST.json records every included source hash, exclusions and the staged phone transformation. Verify archive SHA-256 supplied separately before extracting, then verify manifest entries. Never restore excluded credentials or personal contact values from chat.
