
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { storeProfilesTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type GenerateDocumentInput } from '../schema';
import { generateDocument } from '../handlers/generate_document';

// Test data setup
const testStore = {
  name: 'Test Store',
  address: 'Jl. Test No. 123, Jakarta',
  phone: '021-1234567',
  email: 'test@store.com',
  npwp: '12.345.678.9-012.000'
};

const testTransaction = {
  transaction_id: 'TXN-001',
  date: new Date('2024-01-15'),
  school_name: 'SD Test School',
  school_address: 'Jl. School No. 456, Jakarta',
  treasurer_name: 'John Doe',
  courier_name: 'Jane Smith',
  additional_notes: 'Test transaction notes',
  subtotal: '100000.00',
  ppn_enabled: true,
  ppn_amount: '11000.00',
  pph22_enabled: false,
  pph22_amount: '0.00',
  pph23_enabled: false,
  pph23_amount: '0.00',
  service_value: null,
  service_type: null,
  school_npwp: '98.765.432.1-012.000',
  materai_required: false,
  total_amount: '111000.00'
};

const testItems = [
  {
    item_code: 'ITEM-001',
    item_name: 'Test Item 1',
    quantity: 2,
    unit_price: '30000.00',
    discount: '5000.00',
    subtotal: '55000.00'
  },
  {
    item_code: 'ITEM-002',
    item_name: 'Test Item 2',
    quantity: 1,
    unit_price: '50000.00',
    discount: '5000.00',
    subtotal: '45000.00'
  }
];

describe('generateDocument', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let transactionId: number;
  let storeId: number;

  beforeEach(async () => {
    // Create store profile
    const storeResult = await db.insert(storeProfilesTable)
      .values(testStore)
      .returning()
      .execute();
    storeId = storeResult[0].id;

    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values(testTransaction)
      .returning()
      .execute();
    transactionId = transactionResult[0].id;

    // Create transaction items
    const itemsWithTransactionId = testItems.map(item => ({
      ...item,
      transaction_id: transactionId
    }));

    await db.insert(transactionItemsTable)
      .values(itemsWithTransactionId)
      .execute();
  });

  it('should throw error for non-existent transaction', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: 99999,
      document_type: 'nota_penjualan',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    await expect(generateDocument(input)).rejects.toThrow(/Transaction with id 99999 not found/);
  });

  it('should throw error for unsupported document type', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'invalid_type' as any,
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    await expect(generateDocument(input)).rejects.toThrow(/Unsupported document type: invalid_type/);
  });

  it('should generate nota_penjualan document', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'nota_penjualan',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('nota_penjualan');
    expect(result.transaction_id).toBe(transactionId);
    expect(result.html_content).toContain('NOTA PENJUALAN');
    expect(result.html_content).toContain('TXN-001');
    expect(result.html_content).toContain('SD Test School');
    expect(result.html_content).toContain('Test Store');
    expect(result.html_content).toContain('ITEM-001');
    expect(result.html_content).toContain('Test Item 1');
    expect(result.html_content).toContain('PPN');
    // Use regex to match currency with possible whitespace variations
    expect(result.html_content).toMatch(/Total:\s*Rp\s+111\.000/);
  });

  it('should generate kwitansi document with custom signer', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'kwitansi',
      override_date: new Date('2024-02-01'),
      document_city: 'Surabaya',
      courier_signer_name: null,
      receiver_signer_name: 'Custom Signer'
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('kwitansi');
    expect(result.html_content).toContain('KWITANSI');
    expect(result.html_content).toContain('Surabaya, 1 Februari 2024');
    expect(result.html_content).toContain('Custom Signer');
    expect(result.html_content).toContain('Terbilang:');
    // Use regex to match currency in the specific context
    expect(result.html_content).toMatch(/Uang sejumlah:\s*<strong>Rp\s+111\.000<\/strong>/);
    expect(result.html_content).toContain('SD Test School');
  });

  it('should generate invoice document', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'invoice',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('invoice');
    expect(result.html_content).toContain('INVOICE');
    expect(result.html_content).toContain('Bill To:');
    expect(result.html_content).toContain('SD Test School');
    expect(result.html_content).toContain('NPWP: 98.765.432.1-012.000');
    expect(result.html_content).toContain('PPN (11%)');
    // Use regex for the styled total
    expect(result.html_content).toMatch(/Total:\s*Rp\s+111\.000/);
  });

  it('should generate BAST document', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'bast',
      override_date: null,
      document_city: 'Bandung',
      courier_signer_name: 'Custom Courier',
      receiver_signer_name: 'Custom Receiver'
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('bast');
    expect(result.html_content).toContain('BERITA ACARA SERAH TERIMA');
    expect(result.html_content).toContain('Custom Courier');
    expect(result.html_content).toContain('Custom Receiver');
    expect(result.html_content).toContain('Bandung,');
    expect(result.html_content).toContain('Yang Menyerahkan');
    expect(result.html_content).toContain('Yang Menerima');
    expect(result.html_content).toContain('ITEM-001');
    expect(result.html_content).toContain('ITEM-002');
  });

  it('should generate surat_pesanan document', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'surat_pesanan',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('surat_pesanan');
    expect(result.html_content).toContain('SURAT PESANAN');
    expect(result.html_content).toContain('Kepada Yth');
    expect(result.html_content).toContain('SD Test School');
    // Use regex to match the specific format in surat pesanan
    expect(result.html_content).toMatch(/Total Pesanan:\s*Rp\s+111\.000/);
    expect(result.html_content).toContain('Bagian Pembelian');
    expect(result.html_content).toContain('Test Item 1');
    expect(result.html_content).toContain('Test Item 2');
  });

  it('should generate faktur_pajak document', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'faktur_pajak',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('faktur_pajak');
    expect(result.html_content).toContain('FAKTUR PAJAK');
    expect(result.html_content).toContain('Pengusaha Kena Pajak Penjual');
    expect(result.html_content).toContain('Pengusaha Kena Pajak Pembeli');
    expect(result.html_content).toContain('12.345.678.9-012.000');
    expect(result.html_content).toContain('98.765.432.1-012.000');
    expect(result.html_content).toContain('Jumlah PPN yang terutang');
    expect(result.html_content).toContain('bukti pungutan pajak yang sah');
  });

  it('should generate proforma_invoice document with watermark', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'proforma_invoice',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.document_type).toBe('proforma_invoice');
    expect(result.html_content).toContain('PROFORMA INVOICE');
    expect(result.html_content).toContain('watermark');
    expect(result.html_content).toContain('PROFORMA');
    expect(result.html_content).toContain('PERHATIAN:');
    expect(result.html_content).toContain('bukan tagihan resmi');
    expect(result.html_content).toContain('Valid until:');
    expect(result.html_content).toContain('Terms & Conditions');
    // Use regex for the estimated total
    expect(result.html_content).toMatch(/Estimated Total:\s*Rp\s+111\.000/);
    expect(result.html_content).toContain('PROF-TXN-001');
  });

  it('should handle transaction without store profile', async () => {
    // Delete store profile
    await db.delete(storeProfilesTable).execute();

    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'nota_penjualan',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.html_content).toContain('NOTA PENJUALAN');
    expect(result.html_content).toContain('TXN-001');
    // Should still work without store data
    expect(result.html_content).not.toContain('Test Store');
  });

  it('should handle transaction with no tax enabled', async () => {
    // Create transaction without taxes
    const noTaxTransaction = {
      ...testTransaction,
      transaction_id: 'TXN-NOTAX',
      ppn_enabled: false,
      ppn_amount: '0.00',
      total_amount: '100000.00'
    };

    const transactionResult = await db.insert(transactionsTable)
      .values(noTaxTransaction)
      .returning()
      .execute();
    
    const noTaxTransactionId = transactionResult[0].id;

    // Create items for no-tax transaction
    const itemsWithTransactionId = testItems.map(item => ({
      ...item,
      transaction_id: noTaxTransactionId
    }));

    await db.insert(transactionItemsTable)
      .values(itemsWithTransactionId)
      .execute();

    const input: GenerateDocumentInput = {
      transaction_id: noTaxTransactionId,
      document_type: 'invoice',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.html_content).toContain('INVOICE');
    expect(result.html_content).not.toContain('PPN (11%)');
    expect(result.html_content).not.toContain('PPh 22');
    expect(result.html_content).not.toContain('PPh 23');
    // Use regex for the total without tax
    expect(result.html_content).toMatch(/Total:\s*Rp\s+100\.000/);
  });

  it('should handle transaction with materai requirement', async () => {
    // Create transaction with materai requirement
    const materaiTransaction = {
      ...testTransaction,
      transaction_id: 'TXN-MATERAI',
      materai_required: true
    };

    const transactionResult = await db.insert(transactionsTable)
      .values(materaiTransaction)
      .returning()
      .execute();
    
    const materaiTransactionId = transactionResult[0].id;

    // Create items for materai transaction
    const itemsWithTransactionId = testItems.map(item => ({
      ...item,
      transaction_id: materaiTransactionId
    }));

    await db.insert(transactionItemsTable)
      .values(itemsWithTransactionId)
      .execute();

    const input: GenerateDocumentInput = {
      transaction_id: materaiTransactionId,
      document_type: 'invoice',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    expect(result.html_content).toContain('INVOICE');
    expect(result.html_content).toContain('memerlukan materai');
  });

  it('should format Indonesian currency correctly', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'nota_penjualan',
      override_date: null,
      document_city: null,
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    // Should contain properly formatted Indonesian currency
    expect(result.html_content).toContain('Rp');
    expect(result.html_content).toMatch(/Rp\s+111\.000/); // Total amount
    expect(result.html_content).toMatch(/Rp\s+100\.000/); // Subtotal
    expect(result.html_content).toMatch(/Rp\s+11\.000/);  // PPN amount
  });

  it('should format Indonesian dates correctly', async () => {
    const input: GenerateDocumentInput = {
      transaction_id: transactionId,
      document_type: 'kwitansi',
      override_date: new Date('2024-06-17'), // Use specific date
      document_city: 'Jakarta',
      courier_signer_name: null,
      receiver_signer_name: null
    };

    const result = await generateDocument(input);

    // Should contain properly formatted Indonesian date
    expect(result.html_content).toContain('Jakarta, 17 Juni 2024');
  });
});
