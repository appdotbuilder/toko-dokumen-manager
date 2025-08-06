
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    // Initialize calculated values
    const subtotal = 0; // Will be calculated when items are added
    
    // Calculate tax amounts based on flags and subtotal/service value
    const ppnAmount = input.ppn_enabled ? subtotal * 0.11 : 0;
    const pph22Amount = input.pph22_enabled ? subtotal * 0.015 : 0;
    const pph23Amount = input.pph23_enabled && input.service_value ? input.service_value * 0.02 : 0;
    
    // Calculate total amount: subtotal + ppn - pph22 - pph23
    const totalAmount = subtotal + ppnAmount - pph22Amount - pph23Amount;
    
    // Determine if materai is required (>= Rp 5,000,000)
    const materaiRequired = totalAmount >= 5000000;

    // Insert transaction record
    const result = await db.insert(transactionsTable)
      .values({
        transaction_id: input.transaction_id,
        date: input.date,
        school_name: input.school_name,
        school_address: input.school_address,
        treasurer_name: input.treasurer_name,
        courier_name: input.courier_name,
        additional_notes: input.additional_notes,
        subtotal: subtotal.toString(), // Convert number to string for numeric column
        ppn_enabled: input.ppn_enabled,
        ppn_amount: ppnAmount.toString(),
        pph22_enabled: input.pph22_enabled,
        pph22_amount: pph22Amount.toString(),
        pph23_enabled: input.pph23_enabled,
        pph23_amount: pph23Amount.toString(),
        service_value: input.service_value?.toString() || null,
        service_type: input.service_type,
        school_npwp: input.school_npwp,
        materai_required: materaiRequired,
        total_amount: totalAmount.toString()
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const transaction = result[0];
    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      ppn_amount: parseFloat(transaction.ppn_amount),
      pph22_amount: parseFloat(transaction.pph22_amount),
      pph23_amount: parseFloat(transaction.pph23_amount),
      service_value: transaction.service_value ? parseFloat(transaction.service_value) : null,
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};
