
import { serial, text, pgTable, timestamp, numeric, integer, boolean, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Store Profile Table
export const storeProfilesTable = pgTable('store_profiles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  npwp: varchar('npwp', { length: 50 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions Table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  transaction_id: varchar('transaction_id', { length: 100 }).notNull().unique(),
  date: timestamp('date').notNull(),
  school_name: varchar('school_name', { length: 255 }).notNull(),
  school_address: text('school_address').notNull(),
  treasurer_name: varchar('treasurer_name', { length: 255 }).notNull(),
  courier_name: varchar('courier_name', { length: 255 }).notNull(),
  additional_notes: text('additional_notes'),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  ppn_enabled: boolean('ppn_enabled').notNull().default(false),
  ppn_amount: numeric('ppn_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  pph22_enabled: boolean('pph22_enabled').notNull().default(false),
  pph22_amount: numeric('pph22_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  pph23_enabled: boolean('pph23_enabled').notNull().default(false),
  pph23_amount: numeric('pph23_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  service_value: numeric('service_value', { precision: 15, scale: 2 }),
  service_type: varchar('service_type', { length: 255 }),
  school_npwp: varchar('school_npwp', { length: 50 }),
  materai_required: boolean('materai_required').notNull().default(false),
  total_amount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transaction Items Table
export const transactionItemsTable = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  item_code: varchar('item_code', { length: 100 }).notNull(),
  item_name: varchar('item_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 15, scale: 2 }).notNull().default('0'),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const transactionsRelations = relations(transactionsTable, ({ many }) => ({
  items: many(transactionItemsTable)
}));

export const transactionItemsRelations = relations(transactionItemsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionItemsTable.transaction_id],
    references: [transactionsTable.id]
  })
}));

// TypeScript types for the table schemas
export type StoreProfile = typeof storeProfilesTable.$inferSelect;
export type NewStoreProfile = typeof storeProfilesTable.$inferInsert;

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

export type TransactionItem = typeof transactionItemsTable.$inferSelect;
export type NewTransactionItem = typeof transactionItemsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  storeProfiles: storeProfilesTable,
  transactions: transactionsTable,
  transactionItems: transactionItemsTable
};
