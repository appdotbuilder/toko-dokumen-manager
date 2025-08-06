
import { db } from '../db';
import { transactionItemsTable, transactionsTable } from '../db/schema';
import { eq, sum } from 'drizzle-orm';

export const deleteTransactionItem = async (id: number): Promise<{ success: boolean }> => {
  try {
    // First, get the transaction item to find its transaction_id
    const itemToDelete = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.id, id))
      .execute();

    if (itemToDelete.length === 0) {
      throw new Error('Transaction item not found');
    }

    const transactionId = itemToDelete[0].transaction_id;

    // Delete the transaction item
    await db.delete(transactionItemsTable)
      .where(eq(transactionItemsTable.id, id))
      .execute();

    // Recalculate transaction totals
    const remainingItems = await db.select({
      subtotal: sum(transactionItemsTable.subtotal)
    })
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    // Get the current transaction to preserve tax settings
    const currentTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    if (currentTransaction.length === 0) {
      throw new Error('Parent transaction not found');
    }

    const transaction = currentTransaction[0];
    const newSubtotal = parseFloat(remainingItems[0].subtotal || '0');

    // Recalculate taxes based on current settings
    let ppnAmount = 0;
    let pph22Amount = 0;
    let pph23Amount = 0;

    if (transaction.ppn_enabled) {
      ppnAmount = newSubtotal * 0.11; // 11% PPN
    }

    if (transaction.pph22_enabled) {
      pph22Amount = newSubtotal * 0.015; // 1.5% PPh 22
    }

    if (transaction.pph23_enabled) {
      pph23Amount = newSubtotal * 0.02; // 2% PPh 23
    }

    // Calculate total amount
    const serviceValue = parseFloat(transaction.service_value || '0');
    const totalAmount = newSubtotal + ppnAmount - pph22Amount - pph23Amount + serviceValue;

    // Update transaction totals
    await db.update(transactionsTable)
      .set({
        subtotal: newSubtotal.toString(),
        ppn_amount: ppnAmount.toString(),
        pph22_amount: pph22Amount.toString(),
        pph23_amount: pph23Amount.toString(),
        total_amount: totalAmount.toString(),
        updated_at: new Date()
      })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Transaction item deletion failed:', error);
    throw error;
  }
};
