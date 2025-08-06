
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, transactionItemsTable } from '../db/schema';
import { type UpdateTransactionInput } from '../schema';
import { updateTransaction } from '../handlers/update_transaction';
import { eq } from 'drizzle-orm';

// Test data
const baseTransactionData = {
  transaction_id: 'TRX001',
  date: new Date('2024-01-01'),
  school_name: 'Test School',
  school_address: 'Test Address',
  treasurer_name: 'Test Treasurer',
  courier_name: 'Test Courier',
  additional_notes: 'Test notes',
  subtotal: '1000.00',
  ppn_enabled: false,
  ppn_amount: '0.00',
  pph22_enabled: false,
  pph22_amount: '0.00',
  pph23_enabled: false,
  pph23_amount: '0.00',
  service_value: null,
  service_type: null,
  school_npwp: null,
  materai_required: false,
  total_amount: '1000.00'
};

const testItemData = {
  item_code: 'ITEM001',
  item_name: 'Test Item',
  quantity: 2,
  unit_price: '500.00',
  discount: '0.00',
  subtotal: '1000.00'
};

describe('updateTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic transaction fields', async () => {
    // Create a test transaction
    const createdTransaction = await db.insert(transactionsTable)
      .values(baseTransactionData)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add transaction item for subtotal calculation
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      school_name: 'Updated School Name',
      treasurer_name: 'Updated Treasurer',
      additional_notes: 'Updated notes'
    };

    const result = await updateTransaction(updateInput);

    expect(result.id).toEqual(transactionId);
    expect(result.school_name).toEqual('Updated School Name');
    expect(result.treasurer_name).toEqual('Updated Treasurer');
    expect(result.additional_notes).toEqual('Updated notes');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.subtotal).toBe('number');
    expect(result.subtotal).toEqual(1000);
  });

  it('should recalculate taxes when tax flags are updated', async () => {
    // Create a test transaction
    const createdTransaction = await db.insert(transactionsTable)
      .values(baseTransactionData)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add transaction item
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      ppn_enabled: true,
      pph22_enabled: true,
      service_value: 200
    };

    const result = await updateTransaction(updateInput);

    expect(result.ppn_enabled).toBe(true);
    expect(result.pph22_enabled).toBe(true);
    expect(typeof result.ppn_amount).toBe('number');
    expect(typeof result.pph22_amount).toBe('number');
    expect(typeof result.service_value).toBe('number');
    
    // PPN = 11% of subtotal = 1000 * 0.11 = 110
    expect(result.ppn_amount).toEqual(110);
    // PPh22 = 1.5% of subtotal = 1000 * 0.015 = 15
    expect(result.pph22_amount).toEqual(15);
    expect(result.service_value).toEqual(200);
    
    // Total = subtotal + ppn - pph22 + service = 1000 + 110 - 15 + 200 = 1295
    expect(result.total_amount).toEqual(1295);
  });

  it('should calculate PPh23 based on service value', async () => {
    // Create a test transaction
    const createdTransaction = await db.insert(transactionsTable)
      .values(baseTransactionData)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add transaction item
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      pph23_enabled: true,
      service_value: 1000,
      service_type: 'Delivery Service'
    };

    const result = await updateTransaction(updateInput);

    expect(result.pph23_enabled).toBe(true);
    expect(result.service_value).toEqual(1000);
    expect(result.service_type).toEqual('Delivery Service');
    
    // PPh23 = 2% of service value = 1000 * 0.02 = 20
    expect(result.pph23_amount).toEqual(20);
    
    // Total = subtotal - pph23 + service = 1000 - 20 + 1000 = 1980
    expect(result.total_amount).toEqual(1980);
  });

  it('should set materai_required for large transactions', async () => {
    // Create a test transaction with high value items
    const highValueTransaction = {
      ...baseTransactionData,
      subtotal: '4000000.00',
      total_amount: '4000000.00'
    };

    const createdTransaction = await db.insert(transactionsTable)
      .values(highValueTransaction)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add high value transaction item
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        unit_price: '2000000.00',
        subtotal: '4000000.00',
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      service_value: 1500000 // This makes total >= 5,000,000
    };

    const result = await updateTransaction(updateInput);

    expect(result.materai_required).toBe(true);
    expect(result.service_value).toEqual(1500000);
  });

  it('should save updated transaction to database', async () => {
    // Create a test transaction
    const createdTransaction = await db.insert(transactionsTable)
      .values(baseTransactionData)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add transaction item
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      school_name: 'Database Updated School',
      ppn_enabled: true
    };

    await updateTransaction(updateInput);

    // Verify in database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].school_name).toEqual('Database Updated School');
    expect(transactions[0].ppn_enabled).toBe(true);
    expect(parseFloat(transactions[0].ppn_amount)).toEqual(110);
    expect(transactions[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent transaction', async () => {
    const updateInput: UpdateTransactionInput = {
      id: 999,
      school_name: 'Non-existent'
    };

    expect(updateTransaction(updateInput)).rejects.toThrow(/transaction not found/i);
  });

  it('should handle null and optional fields correctly', async () => {
    // Create a test transaction
    const createdTransaction = await db.insert(transactionsTable)
      .values(baseTransactionData)
      .returning()
      .execute();

    const transactionId = createdTransaction[0].id;

    // Add transaction item
    await db.insert(transactionItemsTable)
      .values({
        ...testItemData,
        transaction_id: transactionId
      })
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: transactionId,
      additional_notes: null,
      service_value: null,
      school_npwp: 'NPWP123456789'
    };

    const result = await updateTransaction(updateInput);

    expect(result.additional_notes).toBeNull();
    expect(result.service_value).toBeNull();
    expect(result.school_npwp).toEqual('NPWP123456789');
  });
});
