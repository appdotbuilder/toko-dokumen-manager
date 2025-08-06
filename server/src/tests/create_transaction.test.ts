
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateTransactionInput = {
  transaction_id: 'TXN-001',
  date: new Date('2024-01-15'),
  school_name: 'SD Test School',
  school_address: '123 School Street, Jakarta',
  treasurer_name: 'John Treasurer',
  courier_name: 'Jane Courier',
  additional_notes: 'Test transaction notes',
  ppn_enabled: false,
  pph22_enabled: false,
  pph23_enabled: false,
  service_value: null,
  service_type: null,
  school_npwp: null
};

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a basic transaction', async () => {
    const result = await createTransaction(testInput);

    // Basic field validation
    expect(result.transaction_id).toEqual('TXN-001');
    expect(result.school_name).toEqual('SD Test School');
    expect(result.school_address).toEqual(testInput.school_address);
    expect(result.treasurer_name).toEqual('John Treasurer');
    expect(result.courier_name).toEqual('Jane Courier');
    expect(result.additional_notes).toEqual('Test transaction notes');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Tax flags should match input
    expect(result.ppn_enabled).toBe(false);
    expect(result.pph22_enabled).toBe(false);
    expect(result.pph23_enabled).toBe(false);
    
    // Numeric fields should be numbers
    expect(typeof result.subtotal).toBe('number');
    expect(typeof result.ppn_amount).toBe('number');
    expect(typeof result.pph22_amount).toBe('number');
    expect(typeof result.pph23_amount).toBe('number');
    expect(typeof result.total_amount).toBe('number');
  });

  it('should save transaction to database', async () => {
    const result = await createTransaction(testInput);

    // Query using proper drizzle syntax
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    const savedTransaction = transactions[0];
    expect(savedTransaction.transaction_id).toEqual('TXN-001');
    expect(savedTransaction.school_name).toEqual('SD Test School');
    expect(savedTransaction.created_at).toBeInstanceOf(Date);
    
    // Verify numeric fields are stored correctly
    expect(parseFloat(savedTransaction.subtotal)).toEqual(0);
    expect(parseFloat(savedTransaction.total_amount)).toEqual(0);
  });

  it('should calculate PPN when enabled', async () => {
    const inputWithPPN: CreateTransactionInput = {
      ...testInput,
      ppn_enabled: true
    };

    const result = await createTransaction(inputWithPPN);

    expect(result.ppn_enabled).toBe(true);
    expect(result.ppn_amount).toEqual(0); // 11% of subtotal (0)
    expect(typeof result.ppn_amount).toBe('number');
  });

  it('should calculate PPH22 when enabled', async () => {
    const inputWithPPH22: CreateTransactionInput = {
      ...testInput,
      pph22_enabled: true
    };

    const result = await createTransaction(inputWithPPH22);

    expect(result.pph22_enabled).toBe(true);
    expect(result.pph22_amount).toEqual(0); // 1.5% of subtotal (0)
    expect(typeof result.pph22_amount).toBe('number');
  });

  it('should calculate PPH23 when enabled with service value', async () => {
    const inputWithPPH23: CreateTransactionInput = {
      ...testInput,
      pph23_enabled: true,
      service_value: 1000000,
      service_type: 'Consulting'
    };

    const result = await createTransaction(inputWithPPH23);

    expect(result.pph23_enabled).toBe(true);
    expect(result.pph23_amount).toEqual(20000); // 2% of service_value (1,000,000)
    expect(result.service_value).toEqual(1000000);
    expect(result.service_type).toEqual('Consulting');
    expect(typeof result.pph23_amount).toBe('number');
    expect(typeof result.service_value).toBe('number');
  });

  it('should not require materai for small transactions', async () => {
    const result = await createTransaction(testInput);

    expect(result.materai_required).toBe(false);
    expect(result.total_amount).toBeLessThan(5000000);
  });

  it('should handle nullable fields correctly', async () => {
    const inputWithNulls: CreateTransactionInput = {
      ...testInput,
      additional_notes: null,
      service_value: null,
      service_type: null,
      school_npwp: null
    };

    const result = await createTransaction(inputWithNulls);

    expect(result.additional_notes).toBe(null);
    expect(result.service_value).toBe(null);
    expect(result.service_type).toBe(null);
    expect(result.school_npwp).toBe(null);
  });

  it('should enforce unique transaction_id constraint', async () => {
    // Create first transaction
    await createTransaction(testInput);

    // Try to create another with same transaction_id
    await expect(createTransaction(testInput)).rejects.toThrow();
  });
});
