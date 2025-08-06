
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { getTransactions } from '../handlers/get_transactions';

// Test transaction data
const testTransaction1: CreateTransactionInput = {
  transaction_id: 'TRX001',
  date: new Date('2024-01-01'),
  school_name: 'SD Negeri 1',
  school_address: 'Jl. Pendidikan No. 1',
  treasurer_name: 'John Doe',
  courier_name: 'Jane Smith',
  additional_notes: 'Test transaction 1',
  ppn_enabled: true,
  pph22_enabled: false,
  pph23_enabled: false,
  service_value: 100000,
  service_type: 'delivery',
  school_npwp: '123456789012345'
};

const testTransaction2: CreateTransactionInput = {
  transaction_id: 'TRX002',
  date: new Date('2024-01-02'),
  school_name: 'SMP Negeri 2',
  school_address: 'Jl. Pendidikan No. 2',
  treasurer_name: 'Alice Brown',
  courier_name: 'Bob Wilson',
  additional_notes: null,
  ppn_enabled: false,
  pph22_enabled: true,
  pph23_enabled: true,
  service_value: null,
  service_type: null,
  school_npwp: null
};

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no transactions exist', async () => {
    const result = await getTransactions();
    expect(result).toEqual([]);
  });

  it('should return all transactions with correct data types', async () => {
    // Create test transactions
    await db.insert(transactionsTable).values({
      transaction_id: testTransaction1.transaction_id,
      date: testTransaction1.date,
      school_name: testTransaction1.school_name,
      school_address: testTransaction1.school_address,
      treasurer_name: testTransaction1.treasurer_name,
      courier_name: testTransaction1.courier_name,
      additional_notes: testTransaction1.additional_notes,
      subtotal: '500000',
      ppn_enabled: testTransaction1.ppn_enabled,
      ppn_amount: '55000',
      pph22_enabled: testTransaction1.pph22_enabled,
      pph22_amount: '0',
      pph23_enabled: testTransaction1.pph23_enabled,
      pph23_amount: '0',
      service_value: testTransaction1.service_value?.toString() || null,
      service_type: testTransaction1.service_type,
      school_npwp: testTransaction1.school_npwp,
      materai_required: false,
      total_amount: '555000'
    }).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(1);
    const transaction = result[0];

    // Check basic fields
    expect(transaction.transaction_id).toEqual('TRX001');
    expect(transaction.school_name).toEqual('SD Negeri 1');
    expect(transaction.date).toBeInstanceOf(Date);

    // Check numeric conversions
    expect(typeof transaction.subtotal).toBe('number');
    expect(transaction.subtotal).toEqual(500000);
    expect(typeof transaction.ppn_amount).toBe('number');
    expect(transaction.ppn_amount).toEqual(55000);
    expect(typeof transaction.total_amount).toBe('number');
    expect(transaction.total_amount).toEqual(555000);
    expect(typeof transaction.service_value).toBe('number');
    expect(transaction.service_value).toEqual(100000);

    // Check boolean fields
    expect(transaction.ppn_enabled).toBe(true);
    expect(transaction.pph22_enabled).toBe(false);
    expect(transaction.pph23_enabled).toBe(false);
  });

  it('should return transactions ordered by date (most recent first)', async () => {
    // Create transactions with different dates
    await db.insert(transactionsTable).values([
      {
        transaction_id: testTransaction1.transaction_id,
        date: testTransaction1.date,
        school_name: testTransaction1.school_name,
        school_address: testTransaction1.school_address,
        treasurer_name: testTransaction1.treasurer_name,
        courier_name: testTransaction1.courier_name,
        additional_notes: testTransaction1.additional_notes,
        subtotal: '500000',
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
        total_amount: '500000'
      },
      {
        transaction_id: testTransaction2.transaction_id,
        date: testTransaction2.date,
        school_name: testTransaction2.school_name,
        school_address: testTransaction2.school_address,
        treasurer_name: testTransaction2.treasurer_name,
        courier_name: testTransaction2.courier_name,
        additional_notes: testTransaction2.additional_notes,
        subtotal: '300000',
        ppn_enabled: false,
        ppn_amount: '0',
        pph22_enabled: true,
        pph22_amount: '3000',
        pph23_enabled: true,
        pph23_amount: '6000',
        service_value: null,
        service_type: null,
        school_npwp: null,
        materai_required: false,
        total_amount: '291000'
      }
    ]).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(2);
    // Most recent first (2024-01-02 before 2024-01-01)
    expect(result[0].transaction_id).toEqual('TRX002');
    expect(result[1].transaction_id).toEqual('TRX001');
    expect(result[0].date > result[1].date).toBe(true);
  });

  it('should handle null numeric fields correctly', async () => {
    // Create transaction with null service_value
    await db.insert(transactionsTable).values({
      transaction_id: 'TRX003',
      date: new Date(),
      school_name: 'Test School',
      school_address: 'Test Address',
      treasurer_name: 'Test Treasurer',
      courier_name: 'Test Courier',
      additional_notes: null,
      subtotal: '100000',
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
      total_amount: '100000'
    }).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].service_value).toBeNull();
    expect(result[0].service_type).toBeNull();
    expect(result[0].school_npwp).toBeNull();
    expect(result[0].additional_notes).toBeNull();
  });
});
