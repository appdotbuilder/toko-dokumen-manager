
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateTransactionInput, type CreateTransactionItemInput } from '../schema';
import { getTransactionById } from '../handlers/get_transaction_by_id';

// Test transaction data
const testTransaction: CreateTransactionInput = {
  transaction_id: 'TRX-001',
  date: new Date('2024-01-15'),
  school_name: 'Test School',
  school_address: '123 Test Street',
  treasurer_name: 'John Doe',
  courier_name: 'Jane Smith',
  additional_notes: 'Test notes',
  ppn_enabled: true,
  pph22_enabled: false,
  pph23_enabled: true,
  service_value: 50000,
  service_type: 'Delivery',
  school_npwp: '12.345.678.9-123.000'
};

// Test transaction items
const testItems: Omit<CreateTransactionItemInput, 'transaction_id'>[] = [
  {
    item_code: 'ITM-001',
    item_name: 'Test Item 1',
    quantity: 10,
    unit_price: 15000,
    discount: 1000
  },
  {
    item_code: 'ITM-002',
    item_name: 'Test Item 2',
    quantity: 5,
    unit_price: 25000,
    discount: 0
  }
];

describe('getTransactionById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return transaction with items when found', async () => {
    // Create transaction first
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: testTransaction.transaction_id,
        date: testTransaction.date,
        school_name: testTransaction.school_name,
        school_address: testTransaction.school_address,
        treasurer_name: testTransaction.treasurer_name,
        courier_name: testTransaction.courier_name,
        additional_notes: testTransaction.additional_notes,
        subtotal: '275000', // (10 * 15000 - 1000) + (5 * 25000) = 149000 + 125000 = 274000
        ppn_enabled: testTransaction.ppn_enabled,
        ppn_amount: '27500', // 10% of subtotal
        pph22_enabled: testTransaction.pph22_enabled,
        pph22_amount: '0',
        pph23_enabled: testTransaction.pph23_enabled,
        pph23_amount: '8250', // 3% of subtotal
        service_value: testTransaction.service_value?.toString(),
        service_type: testTransaction.service_type,
        school_npwp: testTransaction.school_npwp,
        materai_required: false,
        total_amount: '294250' // subtotal + ppn - pph23 = 275000 + 27500 - 8250
      })
      .returning()
      .execute();

    const createdTransactionId = transactionResult[0].id;

    // Create transaction items
    for (const item of testItems) {
      await db.insert(transactionItemsTable)
        .values({
          transaction_id: createdTransactionId,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          discount: item.discount.toString(),
          subtotal: ((item.quantity * item.unit_price) - item.discount).toString()
        })
        .execute();
    }

    // Test the handler
    const result = await getTransactionById(createdTransactionId);

    expect(result).not.toBeNull();
    expect(result!.transaction.id).toEqual(createdTransactionId);
    expect(result!.transaction.transaction_id).toEqual('TRX-001');
    expect(result!.transaction.school_name).toEqual('Test School');
    expect(result!.transaction.subtotal).toEqual(275000);
    expect(result!.transaction.ppn_amount).toEqual(27500);
    expect(result!.transaction.pph23_amount).toEqual(8250);
    expect(result!.transaction.service_value).toEqual(50000);
    expect(result!.transaction.total_amount).toEqual(294250);
    expect(result!.transaction.created_at).toBeInstanceOf(Date);

    // Check items
    expect(result!.items).toHaveLength(2);
    
    const item1 = result!.items.find(item => item.item_code === 'ITM-001');
    expect(item1).toBeDefined();
    expect(item1!.item_name).toEqual('Test Item 1');
    expect(item1!.quantity).toEqual(10);
    expect(item1!.unit_price).toEqual(15000);
    expect(item1!.discount).toEqual(1000);
    expect(item1!.subtotal).toEqual(149000);
    expect(item1!.created_at).toBeInstanceOf(Date);

    const item2 = result!.items.find(item => item.item_code === 'ITM-002');
    expect(item2).toBeDefined();
    expect(item2!.item_name).toEqual('Test Item 2');
    expect(item2!.quantity).toEqual(5);
    expect(item2!.unit_price).toEqual(25000);
    expect(item2!.discount).toEqual(0);
    expect(item2!.subtotal).toEqual(125000);
  });

  it('should return null when transaction not found', async () => {
    const result = await getTransactionById(999);
    expect(result).toBeNull();
  });

  it('should return transaction with empty items array when no items exist', async () => {
    // Create transaction without items
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TRX-002',
        date: new Date('2024-01-16'),
        school_name: 'Empty School',
        school_address: '456 Empty Street',
        treasurer_name: 'Empty Treasurer',
        courier_name: 'Empty Courier',
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
      .returning()
      .execute();

    const result = await getTransactionById(transactionResult[0].id);

    expect(result).not.toBeNull();
    expect(result!.transaction.transaction_id).toEqual('TRX-002');
    expect(result!.items).toHaveLength(0);
    expect(result!.transaction.subtotal).toEqual(0);
    expect(result!.transaction.service_value).toBeNull();
  });

  it('should handle numeric conversion correctly', async () => {
    // Create transaction with various numeric values
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_id: 'TRX-003',
        date: new Date(),
        school_name: 'Numeric Test School',
        school_address: 'Test Address',
        treasurer_name: 'Test Treasurer',
        courier_name: 'Test Courier',
        additional_notes: null,
        subtotal: '123.45',
        ppn_enabled: true,
        ppn_amount: '12.35',
        pph22_enabled: true,
        pph22_amount: '2.47',
        pph23_enabled: true,
        pph23_amount: '3.70',
        service_value: '999.99',
        service_type: 'Test Service',
        school_npwp: null,
        materai_required: false,
        total_amount: '1129.62'
      })
      .returning()
      .execute();

    const result = await getTransactionById(transactionResult[0].id);

    expect(result).not.toBeNull();
    expect(typeof result!.transaction.subtotal).toBe('number');
    expect(result!.transaction.subtotal).toEqual(123.45);
    expect(typeof result!.transaction.ppn_amount).toBe('number');
    expect(result!.transaction.ppn_amount).toEqual(12.35);
    expect(typeof result!.transaction.pph22_amount).toBe('number');
    expect(result!.transaction.pph22_amount).toEqual(2.47);
    expect(typeof result!.transaction.pph23_amount).toBe('number');
    expect(result!.transaction.pph23_amount).toEqual(3.70);
    expect(typeof result!.transaction.service_value).toBe('number');
    expect(result!.transaction.service_value).toEqual(999.99);
    expect(typeof result!.transaction.total_amount).toBe('number');
    expect(result!.transaction.total_amount).toEqual(1129.62);
  });
});
