
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateTransactionItemInput } from '../schema';
import { getTransactionItems } from '../handlers/get_transaction_items';

// Test transaction items
const testItems: CreateTransactionItemInput[] = [
  {
    transaction_id: 1,
    item_code: 'ITEM-001',
    item_name: 'Test Item 1',
    quantity: 10,
    unit_price: 25.50,
    discount: 2.50
  },
  {
    transaction_id: 1,
    item_code: 'ITEM-002',
    item_name: 'Test Item 2',
    quantity: 5,
    unit_price: 100.00,
    discount: 0
  },
  {
    transaction_id: 1,
    item_code: 'ITEM-003',
    item_name: 'Test Item 3',
    quantity: 2,
    unit_price: 75.25,
    discount: 5.00
  }
];

describe('getTransactionItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for non-existent transaction', async () => {
    const result = await getTransactionItems(999);
    expect(result).toEqual([]);
  });

  it('should return empty array for transaction with no items', async () => {
    // Create transaction without items
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 Test Street',
        treasurer_name: 'John Doe',
        courier_name: 'Jane Smith',
        additional_notes: null,
        subtotal: '0',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '0'
      })
      .execute();

    const result = await getTransactionItems(1);
    expect(result).toEqual([]);
  });

  it('should return all items for a transaction', async () => {
    // Create transaction first
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 Test Street',
        treasurer_name: 'John Doe',
        courier_name: 'Jane Smith',
        additional_notes: null,
        subtotal: '780.50',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '780.50'
      })
      .execute();

    // Create transaction items
    for (const item of testItems) {
      const subtotal = (item.quantity * item.unit_price) - item.discount;
      await db.insert(transactionItemsTable)
        .values({
          transaction_id: item.transaction_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          discount: item.discount.toString(),
          subtotal: subtotal.toString()
        })
        .execute();
    }

    const result = await getTransactionItems(1);

    expect(result).toHaveLength(3);

    // Verify first item
    expect(result[0].item_code).toEqual('ITEM-001');
    expect(result[0].item_name).toEqual('Test Item 1');
    expect(result[0].quantity).toEqual(10);
    expect(result[0].unit_price).toEqual(25.50);
    expect(result[0].discount).toEqual(2.50);
    expect(result[0].subtotal).toEqual(252.50); // (10 * 25.50) - 2.50
    expect(typeof result[0].unit_price).toEqual('number');
    expect(typeof result[0].discount).toEqual('number');
    expect(typeof result[0].subtotal).toEqual('number');

    // Verify second item
    expect(result[1].item_code).toEqual('ITEM-002');
    expect(result[1].unit_price).toEqual(100.00);
    expect(result[1].discount).toEqual(0);
    expect(result[1].subtotal).toEqual(500.00); // (5 * 100.00) - 0

    // Verify third item
    expect(result[2].item_code).toEqual('ITEM-003');
    expect(result[2].unit_price).toEqual(75.25);
    expect(result[2].discount).toEqual(5.00);
    expect(result[2].subtotal).toEqual(145.50); // (2 * 75.25) - 5.00
  });

  it('should return items in creation order', async () => {
    // Create transaction first
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 Test Street',
        treasurer_name: 'John Doe',
        courier_name: 'Jane Smith',
        additional_notes: null,
        subtotal: '100.00',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '100.00'
      })
      .execute();

    // Create items with slight delays to ensure different timestamps
    const item1 = testItems[0];
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: item1.transaction_id,
        item_code: item1.item_code,
        item_name: item1.item_name,
        quantity: item1.quantity,
        unit_price: item1.unit_price.toString(),
        discount: item1.discount.toString(),
        subtotal: '252.50'
      })
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const item2 = testItems[1];
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: item2.transaction_id,
        item_code: item2.item_code,
        item_name: item2.item_name,
        quantity: item2.quantity,
        unit_price: item2.unit_price.toString(),
        discount: item2.discount.toString(),
        subtotal: '500.00'
      })
      .execute();

    const result = await getTransactionItems(1);

    expect(result).toHaveLength(2);
    expect(result[0].item_code).toEqual('ITEM-001'); // First created
    expect(result[1].item_code).toEqual('ITEM-002'); // Second created
    expect(result[0].created_at <= result[1].created_at).toBe(true);
  });

  it('should filter items by transaction_id correctly', async () => {
    // Create two transactions
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-001',
        date: new Date('2024-01-15'),
        school_name: 'Test School',
        school_address: '123 Test Street',
        treasurer_name: 'John Doe',
        courier_name: 'Jane Smith',
        additional_notes: null,
        subtotal: '100.00',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '100.00'
      })
      .execute();

    await db.insert(transactionsTable)
      .values({
        transaction_id: 'TXN-002',
        date: new Date('2024-01-16'),
        school_name: 'Test School 2',
        school_address: '456 Test Avenue',
        treasurer_name: 'Jane Doe',
        courier_name: 'John Smith',
        additional_notes: null,
        subtotal: '200.00',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: false,
        pph22_amount: '0',
        pph23_enabled: false,
        pph23_amount: '0',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '200.00'
      })
      .execute();

    // Create items for transaction 1
    const item1 = { ...testItems[0], transaction_id: 1 };
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: item1.transaction_id,
        item_code: item1.item_code,
        item_name: item1.item_name,
        quantity: item1.quantity,
        unit_price: item1.unit_price.toString(),
        discount: item1.discount.toString(),
        subtotal: '252.50'
      })
      .execute();

    // Create items for transaction 2
    const item2 = { ...testItems[1], transaction_id: 2 };
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: item2.transaction_id,
        item_code: item2.item_code,
        item_name: item2.item_name,
        quantity: item2.quantity,
        unit_price: item2.unit_price.toString(),
        discount: item2.discount.toString(),
        subtotal: '500.00'
      })
      .execute();

    // Should only return items for transaction 1
    const result1 = await getTransactionItems(1);
    expect(result1).toHaveLength(1);
    expect(result1[0].transaction_id).toEqual(1);
    expect(result1[0].item_code).toEqual('ITEM-001');

    // Should only return items for transaction 2
    const result2 = await getTransactionItems(2);
    expect(result2).toHaveLength(1);
    expect(result2[0].transaction_id).toEqual(2);
    expect(result2[0].item_code).toEqual('ITEM-002');
  });
});
