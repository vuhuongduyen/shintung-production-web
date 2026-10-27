import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appRecords = sqliteTable("app_records", {
  entity: text("entity").notNull(),
  recordKey: text("record_key").notNull(),
  payload: text("payload").notNull(),
  updatedBy: text("updated_by").notNull().default("web-user"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_app_records_entity").on(table.entity),
  uniqueIndex("idx_app_records_entity_key").on(table.entity, table.recordKey),
]);

// Explicitly created production examples use the same workflow, with separate storage.
export const productionExampleRecords = sqliteTable("production_example_records", {
  entity: text("entity").notNull(),
  recordKey: text("record_key").notNull(),
  payload: text("payload").notNull(),
  updatedBy: text("updated_by").notNull().default("web-user"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_production_examples_entity").on(table.entity),
  uniqueIndex("idx_production_examples_entity_key").on(table.entity, table.recordKey),
]);
