
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type TransactionWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export const getTransactionById = async (id: number): Promise<TransactionWithItems | null> => {
  try {
    // First get the transaction
    const transactionResults = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();

    if (transactionResults.length === 0) {
      return null;
    }

    const transaction = transactionResults[0];

    // Then get the transaction items
    const itemResults = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, id))
      .execute();

    // Convert numeric fields for transaction
    const convertedTransaction = {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      ppn_amount: parseFloat(transaction.ppn_amount),
      pph22_amount: parseFloat(transaction.pph22_amount),
      pph23_amount: parseFloat(transaction.pph23_amount),
      service_value: transaction.service_value ? parseFloat(transaction.service_value) : null,
      total_amount: parseFloat(transaction.total_amount)
    };

    // Convert numeric fields for items
    const convertedItems = itemResults.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      discount: parseFloat(item.discount),
      subtotal: parseFloat(item.subtotal)
    }));

    return {
      transaction: convertedTransaction,
      items: convertedItems
    };
  } catch (error) {
    console.error('Get transaction by ID failed:', error);
    throw error;
  }
};
