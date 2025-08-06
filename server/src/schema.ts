
import { z } from 'zod';

// Store Profile Schema
export const storeProfileSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string().email(),
  npwp: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StoreProfile = z.infer<typeof storeProfileSchema>;

export const createStoreProfileInputSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email is required"),
  npwp: z.string().min(1, "NPWP is required")
});

export type CreateStoreProfileInput = z.infer<typeof createStoreProfileInputSchema>;

export const updateStoreProfileInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  npwp: z.string().optional()
});

export type UpdateStoreProfileInput = z.infer<typeof updateStoreProfileInputSchema>;

// Transaction Schema
export const transactionSchema = z.object({
  id: z.number(),
  transaction_id: z.string(),
  date: z.coerce.date(),
  school_name: z.string(),
  school_address: z.string(),
  treasurer_name: z.string(),
  courier_name: z.string(),
  additional_notes: z.string().nullable(),
  subtotal: z.number(),
  ppn_enabled: z.boolean(),
  ppn_amount: z.number(),
  pph22_enabled: z.boolean(),
  pph22_amount: z.number(),
  pph23_enabled: z.boolean(),
  pph23_amount: z.number(),
  service_value: z.number().nullable(),
  service_type: z.string().nullable(),
  school_npwp: z.string().nullable(),
  materai_required: z.boolean(),
  total_amount: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  transaction_id: z.string().min(1, "Transaction ID is required"),
  date: z.coerce.date(),
  school_name: z.string().min(1, "School name is required"),
  school_address: z.string().min(1, "School address is required"),
  treasurer_name: z.string().min(1, "Treasurer name is required"),
  courier_name: z.string().min(1, "Courier name is required"),
  additional_notes: z.string().nullable(),
  ppn_enabled: z.boolean().default(false),
  pph22_enabled: z.boolean().default(false),
  pph23_enabled: z.boolean().default(false),
  service_value: z.number().nullable(),
  service_type: z.string().nullable(),
  school_npwp: z.string().nullable()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionInputSchema = z.object({
  id: z.number(),
  transaction_id: z.string().optional(),
  date: z.coerce.date().optional(),
  school_name: z.string().optional(),
  school_address: z.string().optional(),
  treasurer_name: z.string().optional(),
  courier_name: z.string().optional(),
  additional_notes: z.string().nullable().optional(),
  ppn_enabled: z.boolean().optional(),
  pph22_enabled: z.boolean().optional(),
  pph23_enabled: z.boolean().optional(),
  service_value: z.number().nullable().optional(),
  service_type: z.string().nullable().optional(),
  school_npwp: z.string().nullable().optional()
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

// Transaction Item Schema
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  item_code: z.string(),
  item_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  discount: z.number(),
  subtotal: z.number(),
  created_at: z.coerce.date()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

export const createTransactionItemInputSchema = z.object({
  transaction_id: z.number(),
  item_code: z.string().min(1, "Item code is required"),
  item_name: z.string().min(1, "Item name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit_price: z.number().nonnegative("Unit price must be non-negative"),
  discount: z.number().nonnegative("Discount must be non-negative").default(0)
});

export type CreateTransactionItemInput = z.infer<typeof createTransactionItemInputSchema>;

export const updateTransactionItemInputSchema = z.object({
  id: z.number(),
  item_code: z.string().optional(),
  item_name: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit_price: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional()
});

export type UpdateTransactionItemInput = z.infer<typeof updateTransactionItemInputSchema>;

// Document Generation Schema
export const documentTypeSchema = z.enum([
  'nota_penjualan',
  'kwitansi',
  'invoice',
  'bast',
  'surat_pesanan',
  'faktur_pajak',
  'proforma_invoice'
]);

export type DocumentType = z.infer<typeof documentTypeSchema>;

export const generateDocumentInputSchema = z.object({
  transaction_id: z.number(),
  document_type: documentTypeSchema,
  override_date: z.coerce.date().nullable(),
  document_city: z.string().nullable(),
  courier_signer_name: z.string().nullable(),
  receiver_signer_name: z.string().nullable()
});

export type GenerateDocumentInput = z.infer<typeof generateDocumentInputSchema>;

export const documentResponseSchema = z.object({
  html_content: z.string(),
  document_type: documentTypeSchema,
  transaction_id: z.number()
});

export type DocumentResponse = z.infer<typeof documentResponseSchema>;

// Complete Transaction with Items Schema (for detailed queries)
export const transactionWithItemsSchema = z.object({
  transaction: transactionSchema,
  items: z.array(transactionItemSchema)
});

export type TransactionWithItems = z.infer<typeof transactionWithItemsSchema>;
