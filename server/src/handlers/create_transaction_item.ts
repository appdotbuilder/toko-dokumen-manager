
import { db } from '../db';
import { transactionItemsTable, transactionsTable } from '../db/schema';
import { type CreateTransactionItemInput, type TransactionItem } from '../schema';
import { eq } from 'drizzle-orm';

export const createTransactionItem = async (input: CreateTransactionItemInput): Promise<TransactionItem> => {
  try {
    // Verify that the transaction exists
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.transaction_id))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error(`Transaction with ID ${input.transaction_id} not found`);
    }

    // Calculate item subtotal
    const subtotal = (input.quantity * input.unit_price) - input.discount;

    // Insert the transaction item
    const result = await db.insert(transactionItemsTable)
      .values({
        transaction_id: input.transaction_id,
        item_code: input.item_code,
        item_name: input.item_name,
        quantity: input.quantity,
        unit_price: input.unit_price.toString(),
        discount: input.discount.toString(),
        subtotal: subtotal.toString()
      })
      .returning()
      .execute();

    const item = result[0];

    // Update parent transaction totals
    await updateTransactionTotals(input.transaction_id);

    // Convert numeric fields back to numbers before returning
    return {
      ...item,
      unit_price: parseFloat(item.unit_price),
      discount: parseFloat(item.discount),
      subtotal: parseFloat(item.subtotal)
    };
  } catch (error) {
    console.error('Transaction item creation failed:', error);
    throw error;
  }
};

// Helper function to recalculate and update transaction totals
const updateTransactionTotals = async (transactionId: number): Promise<void> => {
  // Get all items for this transaction
  const items = await db.select()
    .from(transactionItemsTable)
    .where(eq(transactionItemsTable.transaction_id, transactionId))
    .execute();

  // Calculate new subtotal
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

  // Get current transaction to preserve tax settings
  const transaction = await db.select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, transactionId))
    .execute();

  const currentTransaction = transaction[0];

  // Calculate tax amounts based on enabled flags
  const ppnAmount = currentTransaction.ppn_enabled ? subtotal * 0.11 : 0;
  const pph22Amount = currentTransaction.pph22_enabled ? subtotal * 0.015 : 0;
  const pph23Amount = currentTransaction.pph23_enabled ? subtotal * 0.02 : 0;

  // Calculate total amount
  const serviceValue = currentTransaction.service_value ? parseFloat(currentTransaction.service_value) : 0;
  const totalAmount = subtotal + ppnAmount - pph22Amount - pph23Amount + serviceValue;

  // Determine if materai is required (total >= 5,000,000)
  const materaiRequired = totalAmount >= 5000000;

  // Update transaction with new totals
  await db.update(transactionsTable)
    .set({
      subtotal: subtotal.toString(),
      ppn_amount: ppnAmount.toString(),
      pph22_amount: pph22Amount.toString(),
      pph23_amount: pph23Amount.toString(),
      materai_required: materaiRequired,
      total_amount: totalAmount.toString(),
      updated_at: new Date()
    })
    .where(eq(transactionsTable.id, transactionId))
    .execute();
};
