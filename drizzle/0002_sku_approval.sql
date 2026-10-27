-- Atomic SKU approval/request history; concurrent stale writes roll back the whole batch.
CREATE TRIGGER sku_revision_guard
BEFORE UPDATE OF payload ON app_records
WHEN NEW.entity = 'sku' AND json_extract(NEW.payload, '$.revision') IS NOT NULL
AND json_extract(NEW.payload, '$.revision') != COALESCE(json_extract(OLD.payload, '$.revision'), 0) + 1
BEGIN
 SELECT RAISE(ABORT, 'SKU_CONFLICT');
END;
