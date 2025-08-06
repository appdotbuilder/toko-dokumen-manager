
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deleteTransaction = async (id: number): Promise<{ success: boolean }> => {
  try {
    // Use database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete all related transaction items first (due to foreign key constraint)
      await tx.delete(transactionItemsTable)
        .where(eq(transactionItemsTable.transaction_id, id))
        .execute();

      // Delete the transaction
      await tx.delete(transactionsTable)
        .where(eq(transactionsTable.id, id))
        .execute();
    });

    return { success: true };
  } catch (error) {
    console.error('Transaction deletion failed:', error);
    throw error;
  }
};
