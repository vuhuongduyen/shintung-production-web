-- Optimistic concurrency guard. D1 batch rolls back plan, transit and audit together.
CREATE TRIGGER production_plan_revision_guard
BEFORE UPDATE OF payload ON app_records
WHEN NEW.entity = 'production_plan' AND json_extract(NEW.payload, '$.schemaVersion') = 2
AND json_extract(NEW.payload, '$.revision') != COALESCE(json_extract(OLD.payload, '$.revision'), 0) + 1
BEGIN
 SELECT RAISE(ABORT, 'PLAN_CONFLICT');
END;
