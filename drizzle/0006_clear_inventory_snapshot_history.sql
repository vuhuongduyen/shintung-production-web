-- One-time reset requested during inventory snapshot setup.
-- Preserve every uploaded inventory workbook; remove only prior snapshot records.
DELETE FROM app_records WHERE entity = 'inventory_snapshot';
