
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type UpdateTransactionInput, type Transaction } from '../schema';
import { eq, sum } from 'drizzle-orm';

export const updateTransaction = async (input: UpdateTransactionInput): Promise<Transaction> => {
  try {
    // First verify the transaction exists
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.id))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error('Transaction not found');
    }

    // Prepare update data, excluding undefined values
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.transaction_id !== undefined) updateData.transaction_id = input.transaction_id;
    if (input.date !== undefined) updateData.date = input.date;
    if (input.school_name !== undefined) updateData.school_name = input.school_name;
    if (input.school_address !== undefined) updateData.school_address = input.school_address;
    if (input.treasurer_name !== undefined) updateData.treasurer_name = input.treasurer_name;
    if (input.courier_name !== undefined) updateData.courier_name = input.courier_name;
    if (input.additional_notes !== undefined) updateData.additional_notes = input.additional_notes;
    if (input.ppn_enabled !== undefined) updateData.ppn_enabled = input.ppn_enabled;
    if (input.pph22_enabled !== undefined) updateData.pph22_enabled = input.pph22_enabled;
    if (input.pph23_enabled !== undefined) updateData.pph23_enabled = input.pph23_enabled;
    if (input.service_value !== undefined) updateData.service_value = input.service_value?.toString();
    if (input.service_type !== undefined) updateData.service_type = input.service_type;
    if (input.school_npwp !== undefined) updateData.school_npwp = input.school_npwp;

    // Get current subtotal from transaction items
    const itemsResult = await db.select({ 
      total: sum(transactionItemsTable.subtotal) 
    })
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, input.id))
      .execute();

    const subtotal = parseFloat(itemsResult[0]?.total || '0');
    updateData.subtotal = subtotal.toString();

    // Recalculate taxes and totals based on updated values
    const currentTransaction = existingTransaction[0];
    const ppnEnabled = input.ppn_enabled !== undefined ? input.ppn_enabled : currentTransaction.ppn_enabled;
    const pph22Enabled = input.pph22_enabled !== undefined ? input.pph22_enabled : currentTransaction.pph22_enabled;
    const pph23Enabled = input.pph23_enabled !== undefined ? input.pph23_enabled : currentTransaction.pph23_enabled;
    const serviceValue = input.service_value !== undefined ? input.service_value : parseFloat(currentTransaction.service_value || '0');

    // Calculate tax amounts
    const ppnAmount = ppnEnabled ? subtotal * 0.11 : 0;
    const pph22Amount = pph22Enabled ? subtotal * 0.015 : 0;
    const pph23Amount = pph23Enabled ? (serviceValue || 0) * 0.02 : 0;

    updateData.ppn_amount = ppnAmount.toString();
    updateData.pph22_amount = pph22Amount.toString();
    updateData.pph23_amount = pph23Amount.toString();

    // Determine if materai is required (total >= 5,000,000)
    const totalBeforeTax = subtotal + (serviceValue || 0);
    const materaiRequired = totalBeforeTax >= 5000000;
    updateData.materai_required = materaiRequired;

    // Calculate total amount
    const totalAmount = subtotal + ppnAmount - pph22Amount - pph23Amount + (serviceValue || 0);
    updateData.total_amount = totalAmount.toString();

    // Update the transaction
    const result = await db.update(transactionsTable)
      .set(updateData)
      .where(eq(transactionsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const updatedTransaction = result[0];
    return {
      ...updatedTransaction,
      subtotal: parseFloat(updatedTransaction.subtotal),
      ppn_amount: parseFloat(updatedTransaction.ppn_amount),
      pph22_amount: parseFloat(updatedTransaction.pph22_amount),
      pph23_amount: parseFloat(updatedTransaction.pph23_amount),
      service_value: updatedTransaction.service_value ? parseFloat(updatedTransaction.service_value) : null,
      total_amount: parseFloat(updatedTransaction.total_amount)
    };
  } catch (error) {
    console.error('Transaction update failed:', error);
    throw error;
  }
};
