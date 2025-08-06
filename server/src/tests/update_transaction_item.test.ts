
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable, storeProfilesTable } from '../db/schema';
import { type UpdateTransactionItemInput } from '../schema';
import { updateTransactionItem } from '../handlers/update_transaction_item';
import { eq } from 'drizzle-orm';

describe('updateTransactionItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let transactionId: number;
  let itemId: number;

  beforeEach(async () => {
    // Create a store profile first
    const storeResult = await db.insert(storeProfilesTable)
      .values({
        name: 'Test Store',
        address: 'Test Address',
        phone: '123456789',
        email: 'test@store.com',
        npwp: '123456789012345'
      })
      .returning()
      .execute();

    // Create a transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN001',
        date: new Date(),
        school_name: 'Test School',
        school_address: 'School Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        additional_notes: null,
        subtotal: '100.00',
        ppn_enabled: true,
        ppn_amount: '11.00',
        pph22_enabled: false,
        pph22_amount: '0.00',
        pph23_enabled: false,
        pph23_amount: '0.00',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '111.00'
      })
      .returning()
      .execute();

    transactionId = transactionResult[0].id;

    // Create a transaction item
    const itemResult = await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        item_code: 'ITEM001',
        item_name: 'Test Item',
        quantity: 2,
        unit_price: '50.00',
        discount: '0.00',
        subtotal: '100.00'
      })
      .returning()
      .execute();

    itemId = itemResult[0].id;
  });

  it('should update item code and name', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      item_code: 'ITEM002',
      item_name: 'Updated Item'
    };

    const result = await updateTransactionItem(input);

    expect(result.id).toEqual(itemId);
    expect(result.item_code).toEqual('ITEM002');
    expect(result.item_name).toEqual('Updated Item');
    expect(result.quantity).toEqual(2); // Should remain unchanged
    expect(result.unit_price).toEqual(50.00);
    expect(result.discount).toEqual(0.00);
    expect(result.subtotal).toEqual(100.00);
  });

  it('should update quantity and recalculate subtotal', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      quantity: 3
    };

    const result = await updateTransactionItem(input);

    expect(result.quantity).toEqual(3);
    expect(result.unit_price).toEqual(50.00);
    expect(result.discount).toEqual(0.00);
    expect(result.subtotal).toEqual(150.00); // 3 * 50.00 - 0.00
  });

  it('should update unit price and recalculate subtotal', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      unit_price: 75.00
    };

    const result = await updateTransactionItem(input);

    expect(result.quantity).toEqual(2);
    expect(result.unit_price).toEqual(75.00);
    expect(result.discount).toEqual(0.00);
    expect(result.subtotal).toEqual(150.00); // 2 * 75.00 - 0.00
  });

  it('should update discount and recalculate subtotal', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      discount: 10.00
    };

    const result = await updateTransactionItem(input);

    expect(result.quantity).toEqual(2);
    expect(result.unit_price).toEqual(50.00);
    expect(result.discount).toEqual(10.00);
    expect(result.subtotal).toEqual(90.00); // 2 * 50.00 - 10.00
  });

  it('should save updated item to database', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      item_code: 'UPDATED',
      quantity: 5,
      unit_price: 20.00,
      discount: 5.00
    };

    await updateTransactionItem(input);

    const items = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.id, itemId))
      .execute();

    expect(items).toHaveLength(1);
    expect(items[0].item_code).toEqual('UPDATED');
    expect(items[0].quantity).toEqual(5);
    expect(parseFloat(items[0].unit_price)).toEqual(20.00);
    expect(parseFloat(items[0].discount)).toEqual(5.00);
    expect(parseFloat(items[0].subtotal)).toEqual(95.00); // 5 * 20.00 - 5.00
  });

  it('should recalculate transaction totals after item update', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      quantity: 4,
      unit_price: 25.00
    };

    await updateTransactionItem(input);

    // Check that transaction totals were recalculated
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    
    // New subtotal should be 4 * 25.00 = 100.00
    expect(parseFloat(transaction.subtotal)).toEqual(100.00);
    // PPN should be 100.00 * 0.11 = 11.00
    expect(parseFloat(transaction.ppn_amount)).toEqual(11.00);
    // Total should be 100.00 + 11.00 = 111.00
    expect(parseFloat(transaction.total_amount)).toEqual(111.00);
  });

  it('should throw error for non-existent item', async () => {
    const input: UpdateTransactionItemInput = {
      id: 99999,
      item_code: 'NONEXISTENT'
    };

    expect(updateTransactionItem(input)).rejects.toThrow(/not found/i);
  });

  it('should handle multiple field updates correctly', async () => {
    const input: UpdateTransactionItemInput = {
      id: itemId,
      item_code: 'MULTI001',
      item_name: 'Multi Update Item',
      quantity: 3,
      unit_price: 40.00,
      discount: 15.00
    };

    const result = await updateTransactionItem(input);

    expect(result.item_code).toEqual('MULTI001');
    expect(result.item_name).toEqual('Multi Update Item');
    expect(result.quantity).toEqual(3);
    expect(result.unit_price).toEqual(40.00);
    expect(result.discount).toEqual(15.00);
    expect(result.subtotal).toEqual(105.00); // 3 * 40.00 - 15.00
  });
});
