
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateTransactionItemInput } from '../schema';
import { createTransactionItem } from '../handlers/create_transaction_item';
import { eq } from 'drizzle-orm';

describe('createTransactionItem', () => {
  let testTransactionId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test transaction first
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TEST-001',
        date: new Date(),
        school_name: 'Test School',
        school_address: 'Test Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        subtotal: '0',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        materai_required: false,
        total_amount: '0'
      })
      .returning()
      .execute();

    testTransactionId = transactionResult[0].id;
  });

  afterEach(resetDB);

  const testInput: CreateTransactionItemInput = {
    transaction_id: 0, // Will be set in each test
    item_code: 'ITEM-001',
    item_name: 'Test Item',
    quantity: 10,
    unit_price: 15000,
    discount: 500
  };

  it('should create a transaction item', async () => {
    const input = { ...testInput, transaction_id: testTransactionId };
    const result = await createTransactionItem(input);

    expect(result.item_code).toEqual('ITEM-001');
    expect(result.item_name).toEqual('Test Item');
    expect(result.quantity).toEqual(10);
    expect(result.unit_price).toEqual(15000);
    expect(result.discount).toEqual(500);
    expect(result.subtotal).toEqual(149500); // (10 * 15000) - 500
    expect(result.transaction_id).toEqual(testTransactionId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save transaction item to database', async () => {
    const input = { ...testInput, transaction_id: testTransactionId };
    const result = await createTransactionItem(input);

    const items = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.id, result.id))
      .execute();

    expect(items).toHaveLength(1);
    expect(items[0].item_code).toEqual('ITEM-001');
    expect(items[0].item_name).toEqual('Test Item');
    expect(items[0].quantity).toEqual(10);
    expect(parseFloat(items[0].unit_price)).toEqual(15000);
    expect(parseFloat(items[0].discount)).toEqual(500);
    expect(parseFloat(items[0].subtotal)).toEqual(149500);
    expect(items[0].transaction_id).toEqual(testTransactionId);
  });

  it('should update parent transaction totals', async () => {
    const input = { ...testInput, transaction_id: testTransactionId };
    await createTransactionItem(input);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, testTransactionId))
      .execute();

    const transaction = transactions[0];
    expect(parseFloat(transaction.subtotal)).toEqual(149500);
    expect(parseFloat(transaction.total_amount)).toEqual(149500);
    expect(transaction.materai_required).toEqual(false); // Less than 5M
  });

  it('should calculate subtotal correctly with zero discount', async () => {
    const input = {
      ...testInput,
      transaction_id: testTransactionId,
      discount: 0
    };
    const result = await createTransactionItem(input);

    expect(result.subtotal).toEqual(150000); // 10 * 15000 - 0
  });

  it('should handle multiple items and update transaction totals', async () => {
    const input1 = { ...testInput, transaction_id: testTransactionId };
    const input2 = {
      ...testInput,
      transaction_id: testTransactionId,
      item_code: 'ITEM-002',
      item_name: 'Test Item 2',
      quantity: 5,
      unit_price: 20000,
      discount: 1000
    };

    await createTransactionItem(input1);
    await createTransactionItem(input2);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, testTransactionId))
      .execute();

    const transaction = transactions[0];
    // Item 1: (10 * 15000) - 500 = 149500
    // Item 2: (5 * 20000) - 1000 = 99000
    // Total: 248500
    expect(parseFloat(transaction.subtotal)).toEqual(248500);
    expect(parseFloat(transaction.total_amount)).toEqual(248500);
  });

  it('should set materai_required when total exceeds 5,000,000', async () => {
    const input = {
      ...testInput,
      transaction_id: testTransactionId,
      quantity: 1,
      unit_price: 5500000,
      discount: 0
    };

    await createTransactionItem(input);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, testTransactionId))
      .execute();

    const transaction = transactions[0];
    expect(parseFloat(transaction.total_amount)).toEqual(5500000);
    expect(transaction.materai_required).toEqual(true);
  });

  it('should throw error for non-existent transaction', async () => {
    const input = { ...testInput, transaction_id: 99999 };

    expect(createTransactionItem(input)).rejects.toThrow(/Transaction with ID 99999 not found/i);
  });

  it('should handle transaction with taxes enabled', async () => {
    // Create transaction with taxes enabled
    const taxTransactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TEST-TAX-001',
        date: new Date(),
        school_name: 'Tax School',
        school_address: 'Tax Address',
        treasurer_name: 'Tax Treasurer',
        courier_name: 'Tax Courier',
        subtotal: '0',
        ppn_enabled: true,
        ppn_amount: '0',
        pph22_enabled: true,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        materai_required: false,
        total_amount: '0'
      })
      .returning()
      .execute();

    const taxTransactionId = taxTransactionResult[0].id;
    const input = { ...testInput, transaction_id: taxTransactionId };

    await createTransactionItem(input);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, taxTransactionId))
      .execute();

    const transaction = transactions[0];
    const subtotal = 149500;
    const ppnAmount = subtotal * 0.11; // 16445
    const pph22Amount = subtotal * 0.015; // 2242.5
    const expectedTotal = subtotal + ppnAmount - pph22Amount; // 149500 + 16445 - 2242.5 = 163702.5

    expect(parseFloat(transaction.subtotal)).toEqual(subtotal);
    expect(parseFloat(transaction.ppn_amount)).toEqual(ppnAmount);
    expect(parseFloat(transaction.pph22_amount)).toEqual(pph22Amount);
    expect(parseFloat(transaction.total_amount)).toEqual(expectedTotal);
  });
});
