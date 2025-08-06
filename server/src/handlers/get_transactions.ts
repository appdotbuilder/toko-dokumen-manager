
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { desc } from 'drizzle-orm';

export const getTransactions = async (): Promise<Transaction[]> => {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.date))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      ppn_amount: parseFloat(transaction.ppn_amount),
      pph22_amount: parseFloat(transaction.pph22_amount),
      pph23_amount: parseFloat(transaction.pph23_amount),
      service_value: transaction.service_value ? parseFloat(transaction.service_value) : null,
      total_amount: parseFloat(transaction.total_amount)
    }));
  } catch (error) {
    console.error('Get transactions failed:', error);
    throw error;
  }
};
