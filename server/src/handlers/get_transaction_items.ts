
import { db } from '../db';
import { transactionItemsTable } from '../db/schema';
import { type TransactionItem } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getTransactionItems = async (transactionId: number): Promise<TransactionItem[]> => {
  try {
    // Query transaction items filtered by transaction_id, ordered by creation time
    const results = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .orderBy(asc(transactionItemsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      discount: parseFloat(item.discount),
      subtotal: parseFloat(item.subtotal)
    }));
  } catch (error) {
    console.error('Failed to fetch transaction items:', error);
    throw error;
  }
};
