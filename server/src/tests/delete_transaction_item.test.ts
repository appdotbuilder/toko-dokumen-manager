
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { deleteTransactionItem } from '../handlers/delete_transaction_item';

describe('deleteTransactionItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete transaction item and update parent transaction totals', async () => {
    // Create a transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date(),
        school_name: 'Test School',
        school_address: 'Test Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        additional_notes: null,
        subtotal: '200.00', // Will be recalculated
        ppn_enabled: true,
        ppn_amount: '22.00', // Will be recalculated
        pph22_enabled: false,
        pph22_amount: '0.00',
        pph23_enabled: false,
        pph23_amount: '0.00',
        service_value: '10.00',
        service_type: 'delivery',
        school_npwp: null,
        materai_required: false,
        total_amount: '232.00' // Will be recalculated
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create two transaction items
    const item1Result = await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM001',
        item_name: 'Test Item 1',
        quantity: 2,
        unit_price: '50.00',
        discount: '0.00',
        subtotal: '100.00'
      })
      .returning()
      .execute();

    const item2Result = await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM002',
        item_name: 'Test Item 2',
        quantity: 1,
        unit_price: '100.00',
        discount: '0.00',
        subtotal: '100.00'
      })
      .returning()
      .execute();

    const itemToDeleteId = item1Result[0].id;

    // Delete the first item
    const result = await deleteTransactionItem(itemToDeleteId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify item was deleted
    const deletedItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.id, itemToDeleteId))
      .execute();

    expect(deletedItems).toHaveLength(0);

    // Verify remaining item still exists
    const remainingItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].id).toBe(item2Result[0].id);

    // Verify transaction totals were updated
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const transaction = updatedTransaction[0];
    expect(parseFloat(transaction.subtotal)).toBe(100.00); // Only item 2 remains
    expect(parseFloat(transaction.ppn_amount)).toBe(11.00); // 11% of 100
    expect(parseFloat(transaction.total_amount)).toBe(121.00); // 100 + 11 + 10 (service)
  });

  it('should handle transaction with multiple tax types', async () => {
    // Create a transaction with all tax types enabled
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-002',
        date: new Date(),
        school_name: 'Test School',
        school_address: 'Test Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        additional_notes: null,
        subtotal: '100.00',
        ppn_enabled: true,
        ppn_amount: '11.00',
        pph22_enabled: true,
        pph22_amount: '1.50',
        pph23_enabled: true,
        pph23_amount: '2.00',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '107.50'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create two items
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM001',
        item_name: 'Test Item 1',
        quantity: 1,
        unit_price: '60.00',
        discount: '0.00',
        subtotal: '60.00'
      })
      .execute();

    const item2Result = await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM002',
        item_name: 'Test Item 2',
        quantity: 1,
        unit_price: '40.00',
        discount: '0.00',
        subtotal: '40.00'
      })
      .returning()
      .execute();

    // Delete the second item
    await deleteTransactionItem(item2Result[0].id);

    // Verify transaction totals with all taxes
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const transaction = updatedTransaction[0];
    expect(parseFloat(transaction.subtotal)).toBe(60.00);
    expect(parseFloat(transaction.ppn_amount)).toBe(6.60); // 11% of 60
    expect(parseFloat(transaction.pph22_amount)).toBe(0.90); // 1.5% of 60
    expect(parseFloat(transaction.pph23_amount)).toBe(1.20); // 2% of 60
    expect(parseFloat(transaction.total_amount)).toBe(64.50); // 60 + 6.60 - 0.90 - 1.20
  });

  it('should handle deletion when no items remain', async () => {
    // Create a transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-003',
        date: new Date(),
        school_name: 'Test School',
        school_address: 'Test Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        additional_notes: null,
        subtotal: '50.00',
        ppn_enabled: false,
        ppn_amount: '0.00',
        pph22_enabled: false,
        pph22_amount: '0.00',
        pph23_enabled: false,
        pph23_amount: '0.00',
        service_value: '5.00',
        service_type: 'delivery',
        school_npwp: null,
        materai_required: false,
        total_amount: '55.00'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create only one item
    const itemResult = await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM001',
        item_name: 'Test Item',
        quantity: 1,
        unit_price: '50.00',
        discount: '0.00',
        subtotal: '50.00'
      })
      .returning()
      .execute();

    // Delete the only item
    const result = await deleteTransactionItem(itemResult[0].id);

    expect(result.success).toBe(true);

    // Verify transaction totals are zero (except service value)
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const transaction = updatedTransaction[0];
    expect(parseFloat(transaction.subtotal)).toBe(0.00);
    expect(parseFloat(transaction.ppn_amount)).toBe(0.00);
    expect(parseFloat(transaction.total_amount)).toBe(5.00); // Only service value remains
  });

  it('should throw error when transaction item does not exist', async () => {
    await expect(deleteTransactionItem(999))
      .rejects.toThrow(/transaction item not found/i);
  });
});
