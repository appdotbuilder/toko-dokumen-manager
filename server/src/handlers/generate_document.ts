
import { db } from '../db';
import { transactionsTable, transactionItemsTable, storeProfilesTable } from '../db/schema';
import { type GenerateDocumentInput, type DocumentResponse } from '../schema';
import { eq } from 'drizzle-orm';

export const generateDocument = async (input: GenerateDocumentInput): Promise<DocumentResponse> => {
  try {
    // Fetch transaction with items
    const transactionResult = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.transaction_id))
      .execute();

    if (transactionResult.length === 0) {
      throw new Error(`Transaction with id ${input.transaction_id} not found`);
    }

    const transaction = {
      ...transactionResult[0],
      subtotal: parseFloat(transactionResult[0].subtotal),
      ppn_amount: parseFloat(transactionResult[0].ppn_amount),
      pph22_amount: parseFloat(transactionResult[0].pph22_amount),
      pph23_amount: parseFloat(transactionResult[0].pph23_amount),
      service_value: transactionResult[0].service_value ? parseFloat(transactionResult[0].service_value) : null,
      total_amount: parseFloat(transactionResult[0].total_amount)
    };

    // Fetch transaction items
    const itemsResult = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, input.transaction_id))
      .execute();

    const items = itemsResult.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      discount: parseFloat(item.discount),
      subtotal: parseFloat(item.subtotal)
    }));

    // Fetch store profile (assuming there's only one)
    const storeResult = await db.select()
      .from(storeProfilesTable)
      .limit(1)
      .execute();

    const store = storeResult.length > 0 ? storeResult[0] : null;

    // Generate HTML content based on document type
    let htmlContent = '';

    switch (input.document_type) {
      case 'nota_penjualan':
        htmlContent = generateNotaPenjualanHTML(transaction, items, store, input);
        break;
      case 'kwitansi':
        htmlContent = generateKwitansiHTML(transaction, items, store, input);
        break;
      case 'invoice':
        htmlContent = generateInvoiceHTML(transaction, items, store, input);
        break;
      case 'bast':
        htmlContent = generateBASTHTML(transaction, items, store, input);
        break;
      case 'surat_pesanan':
        htmlContent = generateSuratPesananHTML(transaction, items, store, input);
        break;
      case 'faktur_pajak':
        htmlContent = generateFakturPajakHTML(transaction, items, store, input);
        break;
      case 'proforma_invoice':
        htmlContent = generateProformaInvoiceHTML(transaction, items, store, input);
        break;
      default:
        throw new Error(`Unsupported document type: ${input.document_type}`);
    }

    return {
      html_content: htmlContent,
      document_type: input.document_type,
      transaction_id: input.transaction_id
    };
  } catch (error) {
    console.error('Document generation failed:', error);
    throw error;
  }
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Helper function to format date
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

// Helper function to convert number to Indonesian text (simplified)
const numberToText = (num: number): string => {
  // Simplified implementation - in real app, use proper Indonesian number-to-text library
  const units = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  const teens = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
  
  if (num === 0) return 'nol';
  if (num < 10) return units[num];
  if (num >= 10 && num < 20) return teens[num - 10];
  
  // For larger numbers, return a simplified version
  return `${Math.floor(num).toLocaleString('id-ID')} rupiah`;
};

const generateNotaPenjualanHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Nota Penjualan - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-info { margin-bottom: 20px; }
        .transaction-info { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total { font-weight: bold; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>NOTA PENJUALAN</h1>
        <p>No: ${transaction.transaction_id}</p>
      </div>
      
      ${store ? `
      <div class="company-info">
        <h3>${store.name}</h3>
        <p>${store.address}</p>
        <p>Telp: ${store.phone} | Email: ${store.email}</p>
        <p>NPWP: ${store.npwp}</p>
      </div>
      ` : ''}
      
      <div class="transaction-info">
        <p><strong>Tanggal:</strong> ${formatDate(new Date(date))}</p>
        <p><strong>Kepada:</strong> ${transaction.school_name}</p>
        <p><strong>Alamat:</strong> ${transaction.school_address}</p>
        <p><strong>Bendahara:</strong> ${transaction.treasurer_name}</p>
        <p><strong>Kurir:</strong> ${transaction.courier_name}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Barang</th>
            <th>Qty</th>
            <th>Harga Satuan</th>
            <th>Diskon</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.item_code}</td>
              <td>${item.item_name}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unit_price)}</td>
              <td class="text-right">${formatCurrency(item.discount)}</td>
              <td class="text-right">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total">
        <p class="text-right">Subtotal: ${formatCurrency(transaction.subtotal)}</p>
        ${transaction.ppn_enabled ? `<p class="text-right">PPN: ${formatCurrency(transaction.ppn_amount)}</p>` : ''}
        ${transaction.pph22_enabled ? `<p class="text-right">PPh 22: ${formatCurrency(transaction.pph22_amount)}</p>` : ''}
        ${transaction.pph23_enabled ? `<p class="text-right">PPh 23: ${formatCurrency(transaction.pph23_amount)}</p>` : ''}
        <p class="text-right total">Total: ${formatCurrency(transaction.total_amount)}</p>
      </div>
      
      ${transaction.additional_notes ? `<p><strong>Catatan:</strong> ${transaction.additional_notes}</p>` : ''}
    </body>
    </html>
  `;
};

const generateKwitansiHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  const city = input.document_city || 'Jakarta';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Kwitansi - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .amount-words { font-style: italic; margin: 20px 0; }
        .signature { margin-top: 50px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KWITANSI</h1>
        <p>No: ${transaction.transaction_id}</p>
      </div>
      
      <p>Sudah terima dari: <strong>${transaction.school_name}</strong></p>
      <p>Uang sejumlah: <strong>${formatCurrency(transaction.total_amount)}</strong></p>
      <div class="amount-words">
        <p><em>Terbilang: ${numberToText(transaction.total_amount)}</em></p>
      </div>
      <p>Untuk pembayaran: Pembelian barang sesuai nota penjualan ${transaction.transaction_id}</p>
      
      <div class="signature">
        <p>${city}, ${formatDate(new Date(date))}</p>
        <br><br><br>
        <p>Yang menerima,</p>
        <br><br>
        <p><strong>${input.receiver_signer_name || (store ? store.name : 'Penerima')}</strong></p>
      </div>
    </body>
    </html>
  `;
};

const generateInvoiceHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .invoice-details { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; }
        .total-section { margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>INVOICE</h1>
          <p>No: ${transaction.transaction_id}</p>
          <p>Date: ${formatDate(new Date(date))}</p>
        </div>
        ${store ? `
        <div>
          <h3>${store.name}</h3>
          <p>${store.address}</p>
          <p>${store.phone}</p>
          <p>${store.email}</p>
        </div>
        ` : ''}
      </div>
      
      <div class="invoice-details">
        <h3>Bill To:</h3>
        <p><strong>${transaction.school_name}</strong></p>
        <p>${transaction.school_address}</p>
        ${transaction.school_npwp ? `<p>NPWP: ${transaction.school_npwp}</p>` : ''}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.item_code}</td>
              <td>${item.item_name}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unit_price)}</td>
              <td class="text-right">${formatCurrency(item.discount)}</td>
              <td class="text-right">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total-section">
        <p class="text-right">Subtotal: ${formatCurrency(transaction.subtotal)}</p>
        ${transaction.ppn_enabled ? `<p class="text-right">PPN (11%): ${formatCurrency(transaction.ppn_amount)}</p>` : ''}
        ${transaction.pph22_enabled ? `<p class="text-right">PPh 22: ${formatCurrency(transaction.pph22_amount)}</p>` : ''}
        ${transaction.pph23_enabled ? `<p class="text-right">PPh 23: ${formatCurrency(transaction.pph23_amount)}</p>` : ''}
        <p class="text-right" style="font-weight: bold; font-size: 1.2em;">Total: ${formatCurrency(transaction.total_amount)}</p>
      </div>
      
      ${transaction.materai_required ? '<p><em>* Dokumen ini memerlukan materai</em></p>' : ''}
    </body>
    </html>
  `;
};

const generateBASTHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  const city = input.document_city || 'Jakarta';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>BAST - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { margin-bottom: 20px; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BERITA ACARA SERAH TERIMA</h1>
        <p>No: ${transaction.transaction_id}</p>
      </div>
      
      <div class="content">
        <p>Pada hari ini ${formatDate(new Date(date))}, telah dilakukan serah terima barang dengan rincian sebagai berikut:</p>
        
        <p><strong>Penyerah:</strong> ${store ? store.name : 'Penjual'}</p>
        <p><strong>Penerima:</strong> ${transaction.school_name}</p>
        <p><strong>Alamat Penerima:</strong> ${transaction.school_address}</p>
        <p><strong>Bendahara:</strong> ${transaction.treasurer_name}</p>
        <p><strong>Kurir:</strong> ${transaction.courier_name}</p>
        
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Kode Barang</th>
              <th>Nama Barang</th>
              <th>Jumlah</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.item_code}</td>
                <td>${item.item_name}</td>
                <td>${item.quantity}</td>
                <td>Baik</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p>Dengan nilai total: <strong>${formatCurrency(transaction.total_amount)}</strong></p>
        
        <p>Barang-barang tersebut di atas telah diserahkan dalam keadaan baik dan telah diterima dengan lengkap.</p>
      </div>
      
      <div class="signature-section">
        <div>
          <p>Yang Menyerahkan,</p>
          <br><br><br>
          <p><strong>${input.courier_signer_name || transaction.courier_name}</strong></p>
        </div>
        <div>
          <p>Yang Menerima,</p>
          <br><br><br>
          <p><strong>${input.receiver_signer_name || transaction.treasurer_name}</strong></p>
        </div>
      </div>
      
      <p style="text-align: center; margin-top: 30px;">${city}, ${formatDate(new Date(date))}</p>
    </body>
    </html>
  `;
};

const generateSuratPesananHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Surat Pesanan - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .letterhead { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      ${store ? `
      <div class="letterhead">
        <h2>${store.name}</h2>
        <p>${store.address}</p>
        <p>Telp: ${store.phone} | Email: ${store.email}</p>
      </div>
      ` : ''}
      
      <div class="header">
        <h1>SURAT PESANAN</h1>
        <p>No: ${transaction.transaction_id}</p>
        <p>Tanggal: ${formatDate(new Date(date))}</p>
      </div>
      
      <p>Kepada Yth,<br>
      <strong>${transaction.school_name}</strong><br>
      ${transaction.school_address}</p>
      
      <p>Dengan hormat,</p>
      <p>Melalui surat ini kami bermaksud melakukan pesanan barang dengan rincian sebagai berikut:</p>
      
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Kode Barang</th>
            <th>Nama Barang</th>
            <th>Jumlah</th>
            <th>Harga Satuan</th>
            <th>Total Harga</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.item_code}</td>
              <td>${item.item_name}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unit_price)}</td>
              <td class="text-right">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p class="text-right"><strong>Total Pesanan: ${formatCurrency(transaction.total_amount)}</strong></p>
      
      <p>Demikian surat pesanan ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
      
      <p style="margin-top: 50px;">Hormat kami,</p>
      <br><br><br>
      <p><strong>Bagian Pembelian</strong></p>
    </body>
    </html>
  `;
};

const generateFakturPajakHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Faktur Pajak - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .tax-info { border: 2px solid #000; padding: 15px; margin-bottom: 20px; }
        .company-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: center; }
        th { background-color: #f0f0f0; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>FAKTUR PAJAK</h2>
        <p>Kode dan Nomor Seri Faktur Pajak: ${transaction.transaction_id}</p>
      </div>
      
      <div class="tax-info">
        <p><strong>Tanggal Faktur:</strong> ${formatDate(new Date(date))}</p>
        <p><strong>Masa Pajak:</strong> ${new Date(date).getMonth() + 1}/${new Date(date).getFullYear()}</p>
      </div>
      
      <div class="company-section">
        <div>
          <h4>Pengusaha Kena Pajak Penjual:</h4>
          ${store ? `
          <p><strong>${store.name}</strong></p>
          <p>${store.address}</p>
          <p>NPWP: ${store.npwp}</p>
          ` : '<p>Data toko tidak tersedia</p>'}
        </div>
        <div>
          <h4>Pengusaha Kena Pajak Pembeli:</h4>
          <p><strong>${transaction.school_name}</strong></p>
          <p>${transaction.school_address}</p>
          ${transaction.school_npwp ? `<p>NPWP: ${transaction.school_npwp}</p>` : '<p>NPWP: -</p>'}
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang/Jasa</th>
            <th>Harga Jual/Penggantian/Uang Muka/Termin</th>
            <th>Diskon</th>
            <th>DPP</th>
            <th>PPN</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const itemPPN = item.subtotal * 0.11; // 11% PPN
            return `
            <tr>
              <td>${index + 1}</td>
              <td class="text-left">${item.item_name}</td>
              <td class="text-right">${formatCurrency(item.unit_price * item.quantity)}</td>
              <td class="text-right">${formatCurrency(item.discount)}</td>
              <td class="text-right">${formatCurrency(item.subtotal)}</td>
              <td class="text-right">${formatCurrency(itemPPN)}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 30px;">
        <p><strong>Jumlah Harga Jual/Penggantian/Uang Muka/Termin:</strong> ${formatCurrency(transaction.subtotal)}</p>
        <p><strong>Jumlah Diskon:</strong> ${formatCurrency(items.reduce((sum, item) => sum + item.discount, 0))}</p>
        <p><strong>Jumlah DPP:</strong> ${formatCurrency(transaction.subtotal)}</p>
        <p><strong>Jumlah PPN yang terutang:</strong> ${formatCurrency(transaction.ppn_amount)}</p>
      </div>
      
      <p style="margin-top: 50px; font-size: 0.9em;">
        <em>Faktur Pajak ini merupakan bukti pungutan pajak yang sah</em>
      </p>
    </body>
    </html>
  `;
};

const generateProformaInvoiceHTML = (transaction: any, items: any[], store: any, input: GenerateDocumentInput): string => {
  const date = input.override_date || transaction.date;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Proforma Invoice - ${transaction.transaction_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; position: relative; }
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 4em;
          color: rgba(200, 200, 200, 0.3);
          z-index: -1;
          pointer-events: none;
        }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .proforma-notice { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; }
        .total-section { margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="watermark">PROFORMA</div>
      
      <div class="proforma-notice">
        <strong>PERHATIAN:</strong> Ini adalah Proforma Invoice - bukan tagihan resmi. 
        Dokumen ini hanya untuk keperluan estimasi harga dan tidak dapat digunakan sebagai bukti pembayaran.
      </div>
      
      <div class="header">
        <div>
          <h1>PROFORMA INVOICE</h1>
          <p>No: PROF-${transaction.transaction_id}</p>
          <p>Date: ${formatDate(new Date(date))}</p>
          <p><strong>Valid until:</strong> ${formatDate(new Date(new Date(date).getTime() + 30 * 24 * 60 * 60 * 1000))}</p>
        </div>
        ${store ? `
        <div>
          <h3>${store.name}</h3>
          <p>${store.address}</p>
          <p>${store.phone}</p>
          <p>${store.email}</p>
        </div>
        ` : ''}
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3>Quotation For:</h3>
        <p><strong>${transaction.school_name}</strong></p>
        <p>${transaction.school_address}</p>
        <p>Contact: ${transaction.treasurer_name}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.item_code}</td>
              <td>${item.item_name}</td>
              <td>${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unit_price)}</td>
              <td class="text-right">${formatCurrency(item.discount)}</td>
              <td class="text-right">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total-section">
        <p class="text-right">Subtotal: ${formatCurrency(transaction.subtotal)}</p>
        ${transaction.ppn_enabled ? `<p class="text-right">PPN (11%): ${formatCurrency(transaction.ppn_amount)}</p>` : ''}
        ${transaction.service_value ? `<p class="text-right">Service (${transaction.service_type}): ${formatCurrency(transaction.service_value)}</p>` : ''}
        <p class="text-right" style="font-weight: bold; font-size: 1.2em;">Estimated Total: ${formatCurrency(transaction.total_amount)}</p>
      </div>
      
      <div style="margin-top: 40px; background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff;">
        <h4>Terms & Conditions:</h4>
        <ul>
          <li>Harga berlaku selama 30 hari dari tanggal proforma invoice</li>
          <li>Harga belum termasuk ongkos kirim (jika ada)</li>
          <li>Pembayaran dilakukan setelah konfirmasi pesanan</li>
          <li>Barang dikirim setelah pembayaran lunas</li>
        </ul>
      </div>
      
      ${transaction.additional_notes ? `
      <div style="margin-top: 20px;">
        <h4>Additional Notes:</h4>
        <p>${transaction.additional_notes}</p>
      </div>
      ` : ''}
    </body>
    </html>
  `;
};
