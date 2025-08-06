
import { db } from '../db';
import { transactionItemsTable, transactionsTable } from '../db/schema';
import { type UpdateTransactionItemInput, type TransactionItem } from '../schema';
import { eq } from 'drizzle-orm';

export const updateTransactionItem = async (input: UpdateTransactionItemInput): Promise<TransactionItem> => {
  try {
    // First get the existing item to check if it exists and get current values
    const existingItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.id, input.id))
      .execute();

    if (existingItems.length === 0) {
      throw new Error(`Transaction item with id ${input.id} not found`);
    }

    const existingItem = existingItems[0];

    // Build update values, using existing values if not provided
    const updateValues = {
      item_code: input.item_code ?? existingItem.item_code,
      item_name: input.item_name ?? existingItem.item_name,
      quantity: input.quantity ?? existingItem.quantity,
      unit_price: input.unit_price?.toString() ?? existingItem.unit_price,
      discount: input.discount?.toString() ?? existingItem.discount
    };

    // Calculate new subtotal
    const quantity = input.quantity ?? existingItem.quantity;
    const unitPrice = input.unit_price ?? parseFloat(existingItem.unit_price);
    const discount = input.discount ?? parseFloat(existingItem.discount);
    const subtotal = (quantity * unitPrice) - discount;

    // Update the transaction item with recalculated subtotal
    const result = await db.update(transactionItemsTable)
      .set({
        ...updateValues,
        subtotal: subtotal.toString()
      })
      .where(eq(transactionItemsTable.id, input.id))
      .returning()
      .execute();

    const updatedItem = result[0];

    // Recalculate transaction totals
    await recalculateTransactionTotals(existingItem.transaction_id);

    // Convert numeric fields back to numbers
    return {
      ...updatedItem,
      unit_price: parseFloat(updatedItem.unit_price),
      discount: parseFloat(updatedItem.discount),
      subtotal: parseFloat(updatedItem.subtotal)
    };
  } catch (error) {
    console.error('Transaction item update failed:', error);
    throw error;
  }
};

async function recalculateTransactionTotals(transactionId: number): Promise<void> {
  // Get all items for this transaction
  const items = await db.select()
    .from(transactionItemsTable)
    .where(eq(transactionItemsTable.transaction_id, transactionId))
    .execute();

  // Calculate new subtotal
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

  // Get current transaction to preserve tax settings
  const transactions = await db.select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, transactionId))
    .execute();

  if (transactions.length === 0) {
    throw new Error(`Transaction with id ${transactionId} not found`);
  }

  const transaction = transactions[0];

  // Recalculate tax amounts based on current settings
  const ppnAmount = transaction.ppn_enabled ? subtotal * 0.11 : 0;
  const pph22Amount = transaction.pph22_enabled ? subtotal * 0.015 : 0;
  const pph23Amount = transaction.pph23_enabled ? subtotal * 0.02 : 0;

  // Calculate total amount
  const serviceValue = transaction.service_value ? parseFloat(transaction.service_value) : 0;
  const totalAmount = subtotal + ppnAmount - pph22Amount - pph23Amount + serviceValue;

  // Update transaction totals
  await db.update(transactionsTable)
    .set({
      subtotal: subtotal.toString(),
      ppn_amount: ppnAmount.toString(),
      pph22_amount: pph22Amount.toString(),
      pph23_amount: pph23Amount.toString(),
      total_amount: totalAmount.toString(),
      updated_at: new Date()
    })
    .where(eq(transactionsTable.id, transactionId))
    .execute();
}
