
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FileText, Download, Edit } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { 
  StoreProfile, 
  CreateStoreProfileInput, 
  Transaction, 
  CreateTransactionInput,
  TransactionItem,
  CreateTransactionItemInput,
  DocumentType,
  GenerateDocumentInput,
  TransactionWithItems
} from '../../server/src/schema';

// Utility function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Utility function to format date for input
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Generate random transaction ID
const generateTransactionId = (): string => {
  const prefix = 'TRX';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

interface TransactionItemForm {
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

function App() {
  // Store Profile State
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [storeFormData, setStoreFormData] = useState<CreateStoreProfileInput>({
    name: '',
    address: '',
    phone: '',
    email: '',
    npwp: ''
  });

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithItems | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [isEditingTransaction, setIsEditingTransaction] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

  // Transaction Form State
  const [transactionFormData, setTransactionFormData] = useState<CreateTransactionInput>({
    transaction_id: generateTransactionId(),
    date: new Date(),
    school_name: '',
    school_address: '',
    treasurer_name: '',
    courier_name: '',
    additional_notes: null,
    ppn_enabled: false,
    pph22_enabled: false,
    pph23_enabled: false,
    service_value: null,
    service_type: null,
    school_npwp: null
  });

  // Transaction Items State
  const [transactionItems, setTransactionItems] = useState<TransactionItemForm[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<TransactionItemForm>({
    item_code: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    discount: 0
  });

  // Document State
  const [documentPreview, setDocumentPreview] = useState<{ html: string; type: DocumentType } | null>(null);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Load store profile
  const loadStoreProfile = useCallback(async () => {
    try {
      const profile = await trpc.getStoreProfile.query();
      setStoreProfile(profile);
      setShowStoreForm(!profile);
    } catch (error) {
      console.error('Failed to load store profile:', error);
    }
  }, []);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    try {
      const result = await trpc.getTransactions.query();
      setTransactions(result);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, []);

  useEffect(() => {
    loadStoreProfile();
    loadTransactions();
  }, [loadStoreProfile, loadTransactions]);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const subtotal = transactionItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price - item.discount);
    }, 0);

    const ppnAmount = transactionFormData.ppn_enabled ? Math.round(subtotal * 0.11) : 0;
    const pph22Amount = transactionFormData.pph22_enabled ? Math.round(subtotal * 0.015) : 0;
    const pph23Amount = transactionFormData.pph23_enabled && transactionFormData.service_value 
      ? Math.round(transactionFormData.service_value * 0.02) : 0;

    const totalAmount = subtotal + ppnAmount - pph22Amount - pph23Amount;
    const materaiRequired = totalAmount >= 5000000;

    return {
      subtotal,
      ppnAmount,
      pph22Amount,
      pph23Amount,
      totalAmount,
      materaiRequired
    };
  }, [transactionItems, transactionFormData]);

  const totals = calculateTotals();

  // Store Profile Handlers
  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (storeProfile) {
        await trpc.updateStoreProfile.mutate({ 
          id: storeProfile.id, 
          ...storeFormData 
        });
      } else {
        await trpc.createStoreProfile.mutate(storeFormData);
      }
      await loadStoreProfile();
      setShowStoreForm(false);
    } catch (error) {
      console.error('Failed to save store profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Transaction Handlers
  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transactionItems.length === 0) {
      alert('Tambahkan minimal satu item transaksi');
      return;
    }

    setIsLoading(true);
    try {
      let transactionId: number;
      
      if (isEditingTransaction && editingTransactionId) {
        await trpc.updateTransaction.mutate({
          id: editingTransactionId,
          ...transactionFormData
        });
        transactionId = editingTransactionId;
      } else {
        const newTransaction = await trpc.createTransaction.mutate(transactionFormData);
        transactionId = newTransaction.id;
      }

      // Clear existing items if editing
      if (isEditingTransaction && selectedTransaction) {
        for (const item of selectedTransaction.items) {
          await trpc.deleteTransactionItem.mutate({ id: item.id });
        }
      }

      // Add new items
      for (const item of transactionItems) {
        const itemData: CreateTransactionItemInput = {
          transaction_id: transactionId,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount
        };
        await trpc.createTransactionItem.mutate(itemData);
      }

      await loadTransactions();
      resetTransactionForm();
      setShowTransactionForm(false);
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetTransactionForm = () => {
    setTransactionFormData({
      transaction_id: generateTransactionId(),
      date: new Date(),
      school_name: '',
      school_address: '',
      treasurer_name: '',
      courier_name: '',
      additional_notes: null,
      ppn_enabled: false,
      pph22_enabled: false,
      pph23_enabled: false,
      service_value: null,
      service_type: null,
      school_npwp: null
    });
    setTransactionItems([]);
    setIsEditingTransaction(false);
    setEditingTransactionId(null);
    setSelectedTransaction(null);
  };

  const handleEditTransaction = async (transaction: Transaction) => {
    try {
      const transactionWithItems = await trpc.getTransactionById.query({ id: transaction.id });
      if (transactionWithItems) {
        setSelectedTransaction(transactionWithItems);
        setTransactionFormData({
          transaction_id: transactionWithItems.transaction.transaction_id,
          date: transactionWithItems.transaction.date,
          school_name: transactionWithItems.transaction.school_name,
          school_address: transactionWithItems.transaction.school_address,
          treasurer_name: transactionWithItems.transaction.treasurer_name,
          courier_name: transactionWithItems.transaction.courier_name,
          additional_notes: transactionWithItems.transaction.additional_notes,
          ppn_enabled: transactionWithItems.transaction.ppn_enabled,
          pph22_enabled: transactionWithItems.transaction.pph22_enabled,
          pph23_enabled: transactionWithItems.transaction.pph23_enabled,
          service_value: transactionWithItems.transaction.service_value,
          service_type: transactionWithItems.transaction.service_type,
          school_npwp: transactionWithItems.transaction.school_npwp
        });
        setTransactionItems(transactionWithItems.items.map((item: TransactionItem) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount
        })));
        setIsEditingTransaction(true);
        setEditingTransactionId(transaction.id);
        setShowTransactionForm(true);
      }
    } catch (error) {
      console.error('Failed to load transaction details:', error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    setIsLoading(true);
    try {
      await trpc.deleteTransaction.mutate({ id });
      await loadTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Transaction Items Handlers
  const handleAddItem = () => {
    if (newItem.item_code && newItem.item_name && newItem.quantity > 0) {
      setTransactionItems((prev: TransactionItemForm[]) => [...prev, newItem]);
      setNewItem({
        item_code: '',
        item_name: '',
        quantity: 1,
        unit_price: 0,
        discount: 0
      });
      setShowAddItem(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setTransactionItems((prev: TransactionItemForm[]) => prev.filter((_, i) => i !== index));
  };

  // Document Generation
  const handleGenerateDocument = async (documentType: DocumentType) => {
    if (!selectedTransaction) return;

    setIsLoading(true);
    try {
      const documentData: GenerateDocumentInput = {
        transaction_id: selectedTransaction.transaction.id,
        document_type: documentType,
        override_date: null,
        document_city: null,
        courier_signer_name: null,
        receiver_signer_name: null
      };

      const response = await trpc.generateDocument.mutate(documentData);
      setDocumentPreview({ html: response.html_content, type: documentType });
      setShowDocumentDialog(true);
    } catch (error) {
      console.error('Failed to generate document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'nota_penjualan', label: 'Nota Penjualan' },
    { value: 'kwitansi', label: 'Kwitansi' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'bast', label: 'BAST' },
    { value: 'surat_pesanan', label: 'Surat Pesanan' },
    { value: 'faktur_pajak', label: 'Faktur Pajak' },
    { value: 'proforma_invoice', label: 'Proforma Invoice' }
  ];

  const taxesEnabled = transactionFormData.ppn_enabled || transactionFormData.pph22_enabled || transactionFormData.pph23_enabled;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Sistem Manajemen Transaksi Toko</h1>
        <p className="text-gray-600">Kelola profil toko, transaksi, dan generate dokumen dengan mudah</p>
      </header>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">🏪 Profil Toko</TabsTrigger>
          <TabsTrigger value="transactions">💰 Transaksi</TabsTrigger>
          <TabsTrigger value="history">📊 Riwayat</TabsTrigger>
        </TabsList>

        {/* Store Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil Toko</CardTitle>
              <CardDescription>
                Kelola informasi toko Anda untuk dokumen transaksi
              </CardDescription>
            </CardHeader>
            <CardContent>
              {storeProfile && !showStoreForm ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Nama Toko</Label>
                      <p className="text-lg font-semibold">{storeProfile.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Email</Label>
                      <p>{storeProfile.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Telepon</Label>
                      <p>{storeProfile.phone}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">NPWP</Label>
                      <p>{storeProfile.npwp}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Alamat</Label>
                    <p>{storeProfile.address}</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setStoreFormData({
                        name: storeProfile.name,
                        address: storeProfile.address,
                        phone: storeProfile.phone,
                        email: storeProfile.email,
                        npwp: storeProfile.npwp
                      });
                      setShowStoreForm(true);
                    }}
                    variant="outline"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profil
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleStoreSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="store-name">Nama Toko *</Label>
                      <Input
                        id="store-name"
                        value={storeFormData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setStoreFormData((prev: CreateStoreProfileInput) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="store-email">Email *</Label>
                      <Input
                        id="store-email"
                        type="email"
                        value={storeFormData.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setStoreFormData((prev: CreateStoreProfileInput) => ({ ...prev, email: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="store-phone">Telepon *</Label>
                      <Input
                        id="store-phone"
                        value={storeFormData.phone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setStoreFormData((prev: CreateStoreProfileInput) => ({ ...prev, phone: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="store-npwp">NPWP *</Label>
                      <Input
                        id="store-npwp"
                        value={storeFormData.npwp}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setStoreFormData((prev: CreateStoreProfileInput) => ({ ...prev, npwp: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="store-address">Alamat *</Label>
                    <Textarea
                      id="store-address"
                      value={storeFormData.address}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setStoreFormData((prev: CreateStoreProfileInput) => ({ ...prev, address: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : (storeProfile ? 'Update Profil' : 'Simpan Profil')}
                    </Button>
                    {storeProfile && (
                      <Button type="button" variant="outline" onClick={() => setShowStoreForm(false)}>
                        Batal
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Buat Transaksi Baru</CardTitle>
                    <CardDescription>Input detail transaksi dan barang yang dijual</CardDescription>
                  </div>
                  <Button onClick={() => setShowTransactionForm(!showTransactionForm)}>
                    {showTransactionForm ? 'Tutup Form' : 'Buat Transaksi'}
                  </Button>
                </div>
              </CardHeader>
              
              {showTransactionForm && (
                <CardContent>
                  <form onSubmit={handleTransactionSubmit} className="space-y-6">
                    {/* Transaction Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="transaction-id">ID Transaksi *</Label>
                        <Input
                          id="transaction-id"
                          value={transactionFormData.transaction_id}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, transaction_id: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="transaction-date">Tanggal *</Label>
                        <Input
                          id="transaction-date"
                          type="date"
                          value={formatDateForInput(transactionFormData.date)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, date: new Date(e.target.value) }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="courier-name">Nama Kurir *</Label>
                        <Input
                          id="courier-name"
                          value={transactionFormData.courier_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, courier_name: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* School Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="school-name">Nama Sekolah/Lembaga *</Label>
                        <Input
                          id="school-name"
                          value={transactionFormData.school_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, school_name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="treasurer-name">Nama Bendahara/Kepala Sekolah *</Label>
                        <Input
                          id="treasurer-name"
                          value={transactionFormData.treasurer_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, treasurer_name: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="school-address">Alamat Sekolah *</Label>
                      <Textarea
                        id="school-address"
                        value={transactionFormData.school_address}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, school_address: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="additional-notes">Catatan Tambahan</Label>
                      <Textarea
                        id="additional-notes"
                        value={transactionFormData.additional_notes || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setTransactionFormData((prev: CreateTransactionInput) => ({ 
                            ...prev, 
                            additional_notes: e.target.value || null 
                          }))
                        }
                      />
                    </div>

                    {/* Tax Options */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Pengaturan Pajak</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="ppn-enabled"
                            checked={transactionFormData.ppn_enabled}
                            onCheckedChange={(checked: boolean) =>
                              setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, ppn_enabled: checked }))
                            }
                          />
                          <Label htmlFor="ppn-enabled">PPN (11%)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="pph22-enabled"
                            checked={transactionFormData.pph22_enabled}
                            onCheckedChange={(checked: boolean) =>
                              setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, pph22_enabled: checked }))
                            }
                          />
                          <Label htmlFor="pph22-enabled">PPh 22 (1.5%)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="pph23-enabled"
                            checked={transactionFormData.pph23_enabled}
                            onCheckedChange={(checked: boolean) =>
                              setTransactionFormData((prev: CreateTransactionInput) => ({ ...prev, pph23_enabled: checked }))
                            }
                          />
                          <Label htmlFor="pph23-enabled">PPh 23 (2% - Jasa)</Label>
                        </div>
                      </div>

                      {/* PPh 23 Service Details */}
                      {transactionFormData.pph23_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                          <div>
                            <Label htmlFor="service-value">Nilai Jasa *</Label>
                            <Input
                              id="service-value"
                              type="number"
                              value={transactionFormData.service_value || 0}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setTransactionFormData((prev: CreateTransactionInput) => ({ 
                                  ...prev, 
                                  service_value: parseFloat(e.target.value) || 0 
                                }))
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="service-type">Jenis Jasa *</Label>
                            <Input
                              id="service-type"
                              value={transactionFormData.service_type || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setTransactionFormData((prev: CreateTransactionInput) => ({ 
                                  ...prev, 
                                  service_type: e.target.value || null 
                                }))
                              }
                              placeholder="Contoh: Jasa Pengiriman"
                              required
                            />
                          </div>
                        </div>
                      )}

                      {/* School NPWP for tax */}
                      {taxesEnabled && (
                        <div>
                          <Label htmlFor="school-npwp">NPWP Sekolah *</Label>
                          <Input
                            id="school-npwp"
                            value={transactionFormData.school_npwp || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setTransactionFormData((prev: CreateTransactionInput) => ({ 
                                ...prev, 
                                school_npwp: e.target.value || null 
                              }))
                            }
                            placeholder="Wajib diisi jika ada pajak yang diaktifkan"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Transaction Items */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Daftar Barang</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddItem(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Barang
                        </Button>
                      </div>

                      {transactionItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Belum ada barang ditambahkan</p>
                      ) : (
                        <div className="space-y-2">
                          {transactionItems.map((item: TransactionItemForm, index: number) => (
                            <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2">
                                <div>
                                  <Label className="text-xs">Kode</Label>
                                  <p className="font-medium">{item.item_code}</p>
                                </div>
                                <div>
                                  <Label className="text-xs">Nama</Label>
                                  <p className="font-medium">{item.item_name}</p>
                                </div>
                                <div>
                                  <Label className="text-xs">Qty</Label>
                                  <p>{item.quantity}</p>
                                </div>
                                <div>
                                  <Label className="text-xs">Harga</Label>
                                  <p>{formatCurrency(item.unit_price)}</p>
                                </div>
                                <div>
                                  <Label className="text-xs">Subtotal</Label>
                                  <p className="font-semibold">
                                    {formatCurrency(item.quantity * item.unit_price - item.discount)}
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                              >
                                
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Item Dialog */}
                      <Dialog open={showAddItem}
                        onOpenChange={setShowAddItem}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Tambah Barang</DialogTitle>
                            <DialogDescription>
                              Masukkan detail barang yang akan dijual
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="item-code">Kode Barang *</Label>
                                <Input
                                  id="item-code"
                                  value={newItem.item_code}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNewItem((prev: TransactionItemForm) => ({ ...prev, item_code: e.target.value }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="item-quantity">Kuantitas *</Label>
                                <Input
                                  id="item-quantity"
                                  type="number"
                                  min="1"
                                  value={newItem.quantity}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNewItem((prev: TransactionItemForm) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="item-name">Nama Barang *</Label>
                              <Input
                                id="item-name"
                                value={newItem.item_name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setNewItem((prev: TransactionItemForm) => ({ ...prev, item_name: e.target.value }))
                                }
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="item-price">Harga Satuan *</Label>
                                <Input
                                  id="item-price"
                                  type="number"
                                  min="0"
                                  value={newItem.unit_price}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNewItem((prev: TransactionItemForm) => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="item-discount">Diskon</Label>
                                <Input
                                  id="item-discount"
                                  type="number"
                                  min="0"
                                  value={newItem.discount}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNewItem((prev: TransactionItemForm) => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleAddItem}>Tambah</Button>
                              <Button variant="outline" onClick={() => setShowAddItem(false)}>Batal</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Totals Summary */}
                    {transactionItems.length > 0 && (
                      <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
                        <h3 className="text-lg font-semibold">Ringkasan Transaksi</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          {transactionFormData.ppn_enabled && (
                            <div className="flex justify-between">
                              <span>PPN (11%):</span>
                              <span className="font-medium">+{formatCurrency(totals.ppnAmount)}</span>
                            </div>
                          )}
                          {transactionFormData.pph22_enabled && (
                            <div className="flex justify-between">
                              <span>PPh 22 (1.5%):</span>
                              <span className="font-medium">-{formatCurrency(totals.pph22Amount)}</span>
                            </div>
                          )}
                          {transactionFormData.pph23_enabled && (
                            <div className="flex justify-between">
                              <span>PPh 23 (2%):</span>
                              <span className="font-medium">-{formatCurrency(totals.pph23Amount)}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span>{formatCurrency(totals.totalAmount)}</span>
                          </div>
                          {totals.materaiRequired && (
                            <p className="text-sm text-amber-600 font-medium">
                              ⚠️ Materai diperlukan (Total ≥ Rp 5.000.000)
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={isLoading || transactionItems.length === 0}>
                        {isLoading ? 'Menyimpan...' : (isEditingTransaction ? 'Update Transaksi' : 'Simpan Transaksi')}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          resetTransactionForm();
                          setShowTransactionForm(false);
                        }}
                      >
                        Batal
                      </Button>
                    </div>
                  </form>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Transaksi</CardTitle>
              <CardDescription>
                Daftar semua transaksi yang telah dibuat
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Belum ada transaksi</p>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction: Transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{transaction.transaction_id}</h3>
                            <Badge variant="secondary">
                              {transaction.date.toLocaleDateString('id-ID')}
                            </Badge>
                            {transaction.materai_required && (
                              <Badge variant="outline" className="text-amber-600 border-amber-600">
                                Materai
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Sekolah:</strong> {transaction.school_name}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Bendahara:</strong> {transaction.treasurer_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Kurir:</strong> {transaction.courier_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(transaction.total_amount)}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {transaction.ppn_enabled && (
                              <Badge variant="outline" className="text-xs">PPN</Badge>
                            )}
                            {transaction.pph22_enabled && (
                              <Badge variant="outline" className="text-xs">PPh22</Badge>
                            )}
                            {transaction.pph23_enabled && (
                              <Badge variant="outline" className="text-xs">PPh23</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTransaction({ transaction, items: [] })}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Dokumen
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Generate Dokumen</DialogTitle>
                              <DialogDescription>
                                Pilih jenis dokumen yang ingin dibuat untuk transaksi {transaction.transaction_id}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                              {documentTypes.map((docType) => (
                                <Button
                                  key={docType.value}
                                  variant="outline"
                                  onClick={() => handleGenerateDocument(docType.value)}
                                  disabled={isLoading}
                                  className="h-auto py-3"
                                >
                                  <div className="text-center">
                                    <FileText className="w-6 h-6 mx-auto mb-1" />
                                    <span className="text-sm">{docType.label}</span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus transaksi {transaction.transaction_id}? 
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTransaction(transaction.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Preview Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Preview Dokumen</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {documentPreview && `Preview ${documentPreview.type.replace('_', ' ').toUpperCase()}`}
            </DialogDescription>
          </DialogHeader>
          {documentPreview && (
            <div 
              className="border rounded-lg p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: documentPreview.html }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
