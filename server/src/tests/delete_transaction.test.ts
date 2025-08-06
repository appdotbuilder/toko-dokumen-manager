
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { deleteTransaction } from '../handlers/delete_transaction';
import { eq } from 'drizzle-orm';

describe('deleteTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a transaction and its items', async () => {
    // Create a transaction first
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 School St',
        treasurer_name: 'John Treasurer',
        courier_name: 'Jane Courier',
        additional_notes: 'Test transaction for deletion',
        subtotal: '500.00',
        ppn_enabled: true,
        ppn_amount: '55.00',
        pph22_enabled: false,
        pph22_amount: '0.00',
        pph23_enabled: false,
        pph23_amount: '0.00',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '555.00'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM-001',
        item_name: 'Test Item',
        quantity: 5,
        unit_price: '100.00',
        discount: '0.00',
        subtotal: '500.00'
      })
      .execute();

    // Verify transaction and items exist
    const initialTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();
    const initialItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    expect(initialTransactions).toHaveLength(1);
    expect(initialItems).toHaveLength(1);

    // Delete the transaction
    const result = await deleteTransaction(transactionId);

    expect(result.success).toBe(true);

    // Verify transaction and items are deleted
    const finalTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();
    const finalItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    expect(finalTransactions).toHaveLength(0);
    expect(finalItems).toHaveLength(0);
  });

  it('should delete transaction with multiple items', async () => {
    // Create a transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-002',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 School St',
        treasurer_name: 'John Treasurer',
        courier_name: 'Jane Courier',
        additional_notes: 'Test transaction for deletion',
        subtotal: '1000.00',
        ppn_enabled: true,
        ppn_amount: '110.00',
        pph22_enabled: false,
        pph22_amount: '0.00',
        pph23_enabled: false,
        pph23_amount: '0.00',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '1110.00'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create multiple transaction items
    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transactionId,
          item_code: 'ITEM-001',
          item_name: 'Test Item',
          quantity: 5,
          unit_price: '100.00',
          discount: '0.00',
          subtotal: '500.00'
        },
        {
          transaction_id: transactionId,
          item_code: 'ITEM-002',
          item_name: 'Test Item 2',
          quantity: 3,
          unit_price: '200.00',
          discount: '100.00',
          subtotal: '500.00'
        }
      ])
      .execute();

    // Verify initial state
    const initialItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    expect(initialItems).toHaveLength(2);

    // Delete the transaction
    const result = await deleteTransaction(transactionId);

    expect(result.success).toBe(true);

    // Verify all items are deleted
    const finalItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    expect(finalItems).toHaveLength(0);
  });

  it('should handle deletion of non-existent transaction', async () => {
    // Try to delete a non-existent transaction
    const result = await deleteTransaction(999999);

    // Should still return success even if nothing was deleted
    expect(result.success).toBe(true);
  });
});
