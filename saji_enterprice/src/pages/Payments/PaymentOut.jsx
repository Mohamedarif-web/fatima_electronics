import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Save, Edit, Trash2 } from 'lucide-react';
import db from '../../utils/database';

const PaymentOut = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    party_id: '',
    account_id: '',
    amount: '',
    payment_mode: 'cash',
    notes: ''
  });

  // New payment flow states (similar to PaymentIn)
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [paymentAllocations, setPaymentAllocations] = useState({});
  const [totalPayment, setTotalPayment] = useState(0);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadAccounts();
    loadPayments();
    
    // Check if we should auto-open the payment form
    const shouldAddPayment = searchParams.get('add') === 'true';
    if (shouldAddPayment) {
      setShowForm(true);
    }
  }, [searchParams]);

  const loadSuppliers = async () => {
    try {
      console.log('🔄 Loading suppliers with updated balances...');
      
      // 🔥 FIX: Get all suppliers first
      const data = await db.query(`
        SELECT 
          supplier_id,
          name,
          phone,
          address,
          opening_balance,
          current_balance
        FROM suppliers 
        WHERE is_deleted = 0
        ORDER BY name ASC
      `);
      
      // 🔥 FIX: Update current balance for each supplier to ensure accuracy
      for (const supplier of data) {
        // Calculate current balance from all transactions (explicit column references)
        const transactions = await db.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN p.payment_type = 'payment_out' THEN -p.amount ELSE 0 END), 0) as total_payments
          FROM payments p
          WHERE p.party_id = ? AND p.is_deleted = 0
        `, [supplier.supplier_id]);
        
        // Get pending purchase bills for this supplier
        const pendingBills = await db.query(`
          SELECT COALESCE(SUM(balance_amount), 0) as total_pending
          FROM purchase_invoices 
          WHERE supplier_id = ? AND balance_amount > 0 AND is_deleted = 0 AND is_cancelled = 0
        `, [supplier.supplier_id]);
        
        const totalPending = pendingBills[0]?.total_pending || 0;
        const totalPayments = Math.abs(transactions[0]?.total_payments || 0);
        
        // Current balance = Opening balance + Pending bills - Payments made
        const updatedBalance = (supplier.opening_balance || 0) + totalPending - totalPayments;
        
        console.log(`📊 Supplier ${supplier.name}: Opening=${supplier.opening_balance}, Pending=${totalPending}, Payments=${totalPayments}, New Balance=${updatedBalance}`);
        
        // Update supplier balance
        await db.run(`
          UPDATE suppliers 
          SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [updatedBalance, supplier.supplier_id]);
        
        supplier.current_balance = updatedBalance;
      }
      
      console.log('✅ Loaded and updated supplier balances:', data.length);
      setSuppliers(data);
    } catch (error) {
      console.error('❌ Error loading suppliers:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await db.query('SELECT * FROM accounts WHERE is_deleted = 0 ORDER BY account_name');
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          p.*,
          s.name as supplier_name,
          s.phone as supplier_phone,
          a.account_name
        FROM payments p
        LEFT JOIN suppliers s ON p.party_id = s.supplier_id
        LEFT JOIN accounts a ON p.account_id = a.account_id
        WHERE p.payment_type = 'payment_out' AND p.is_deleted = 0
        ORDER BY p.payment_date DESC, p.payment_id DESC
      `);
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({ ...prev, [name]: value }));
  };

  const selectSupplier = async (supplier) => {
    // 🔥 FIX: Update supplier balance before selecting to ensure latest data
    console.log(`👤 Selected supplier: ${supplier.name}, Current Balance: ₹${supplier.current_balance}`);
    
    setPaymentData(prev => ({ ...prev, party_id: supplier.supplier_id }));
    setSelectedSupplier(supplier);
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
    
    // Load pending purchase invoices for the selected supplier
    await loadPendingInvoices(supplier.supplier_id);
  };

  // 🔥 ADD: Edit payment function
  const editPayment = async (payment) => {
    console.log('📝 Editing payment:', payment.payment_number);
    console.log('🔍 FULL Payment data:', payment);
    
    // 🔥 FIX: Ensure suppliers are loaded before editing
    if (suppliers.length === 0) {
      console.log('🔄 Suppliers not loaded, loading them first...');
      await loadSuppliers();
    }
    
    // 🔥 FIX: Set editing state first
    setEditingPayment(payment);
    
    // 🔥 FIX: Find supplier correctly (payment.party_id matches supplier.supplier_id)
    const supplier = suppliers.find(s => s.supplier_id === payment.party_id);
    console.log('🔍 Found supplier:', supplier);
    console.log('🔍 Suppliers available:', suppliers.length);
    
    if (supplier) {
      // Set form data first - with immediate effect
      const formData = {
        payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
        party_id: payment.party_id,
        account_id: payment.account_id || '',
        amount: (payment.amount || 0).toString(),
        payment_mode: payment.payment_mode || 'cash',
        cheque_number: payment.cheque_number || '',
        cheque_date: payment.cheque_date || '',
        bank_ref: payment.bank_ref || '',
        notes: payment.notes || ''
      };
      
      console.log('📋 Form data being set:', formData);
      
      // Force update form data
      setPaymentData(() => formData);
      
      // Set supplier data
      setSelectedSupplier(supplier);
      setSupplierSearch(supplier.name);
      setShowSupplierDropdown(false);
      
      console.log(`✅ Edit Mode - Loaded payment: ₹${payment.amount} for supplier: ${supplier.name}`);
      
    } else {
      console.error('❌ Supplier not found for party_id:', payment.party_id);
      console.log('Available suppliers:', suppliers.map(s => ({id: s.supplier_id, name: s.name})));
      
      // 🔥 FIX: If supplier still not found, load fresh data and try again
      console.log('🔄 Reloading suppliers and trying again...');
      await loadSuppliers();
      const freshSupplier = suppliers.find(s => s.supplier_id === payment.party_id);
      if (freshSupplier) {
        console.log('✅ Found supplier after reload:', freshSupplier.name);
        setSelectedSupplier(freshSupplier);
        setSupplierSearch(freshSupplier.name);
        
        // Set form data
        const formData = {
          payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
          party_id: payment.party_id,
          account_id: payment.account_id || '',
          amount: (payment.amount || 0).toString(),
          payment_mode: payment.payment_mode || 'cash',
          cheque_number: payment.cheque_number || '',
          cheque_date: payment.cheque_date || '',
          bank_ref: payment.bank_ref || '',
          notes: payment.notes || ''
        };
        setPaymentData(() => formData);
      } else {
        alert('Supplier not found. Please try again.');
        return;
      }
    }
    
    // Open form after setting all data
    setShowForm(true);
  };

  // 🔥 ADD: Delete payment function
  const deletePayment = async (payment) => {
    if (!confirm(`Are you sure you want to delete payment ${payment.payment_number}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setLoading(true);
      console.log('🗑️ Deleting payment:', payment.payment_number);
      
      // Reverse the account balance (add back the amount)
      if (payment.account_id) {
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [payment.amount, payment.account_id]);
        
        console.log(`🏦 Reversed account balance: +₹${payment.amount}`);
      }
      
      // 🔥 FIX: Reverse the supplier balance (add back the payable amount) in suppliers table
      await db.run(`
        UPDATE suppliers 
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE supplier_id = ?
      `, [payment.amount, payment.party_id]);
      
      console.log(`👤 Reversed supplier balance: +₹${payment.amount}`);
      
      // Mark payment as deleted
      await db.run(`
        UPDATE payments 
        SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE payment_id = ?
      `, [payment.payment_id]);
      
      alert(`Payment ${payment.payment_number} deleted successfully!`);
      
      // Reload data
      await loadPayments();
      await loadSuppliers();
      
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvoices = async (supplierId) => {
    try {
      console.log('🔄 Loading pending purchase invoices for supplier:', supplierId);
      const invoices = await db.query(`
        SELECT 
          purchase_id as invoice_id,
          bill_number as invoice_number,
          bill_date as invoice_date,
          total_amount,
          balance_amount as pending_amount
        FROM purchase_invoices 
        WHERE supplier_id = ? 
        AND balance_amount > 0 
        AND is_cancelled = 0 
        AND is_deleted = 0
        ORDER BY bill_date ASC
      `, [supplierId]);
      
      console.log('📋 Loaded pending purchase invoices:', invoices);
      setPendingInvoices(invoices);
      
      // Reset payment allocations
      setPaymentAllocations({});
      setTotalPayment(0);
    } catch (error) {
      console.error('❌ Error loading pending purchase invoices:', error);
    }
  };

  const updatePaymentAllocation = (invoiceId, amount) => {
    const numericAmount = parseFloat(amount) || 0;
    
    setPaymentAllocations(prev => {
      const updated = { ...prev };
      if (numericAmount === 0) {
        delete updated[invoiceId];
      } else {
        updated[invoiceId] = numericAmount;
      }
      return updated;
    });
    
    // Recalculate total payment in real-time
    const newAllocations = { ...paymentAllocations };
    if (numericAmount === 0) {
      delete newAllocations[invoiceId];
    } else {
      newAllocations[invoiceId] = numericAmount;
    }
    
    const total = Object.values(newAllocations).reduce((sum, amt) => sum + amt, 0);
    setTotalPayment(total);
  };

  const savePayment = async () => {
    if (!paymentData.party_id || !paymentData.amount || !paymentData.account_id) {
      alert('Please fill all required fields: supplier, amount, and account.');
      return;
    }

    // 🔥 SIMPLIFIED: Skip validation for edits - let users edit as needed
    const paymentAmountNum = parseFloat(paymentData.amount);

    try {
      setLoading(true);
      
      if (editingPayment) {
        // UPDATE EXISTING PAYMENT
        console.log('📝 Updating payment:', editingPayment.payment_number);
        console.log(`   Original amount: ₹${editingPayment.amount}, New amount: ₹${paymentAmountNum}`);
        
        // Reverse original account balance
        if (editingPayment.account_id) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [editingPayment.amount, editingPayment.account_id]);
        }

        // 🔥 FIX: Reverse original supplier balance (add back the payable amount)
        await db.run(`
          UPDATE suppliers 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [editingPayment.amount, editingPayment.party_id]);

        // Update payment record
        await db.run(`
          UPDATE payments SET
            payment_date = ?, party_id = ?, account_id = ?, amount = ?,
            payment_mode = ?, cheque_number = ?, cheque_date = ?, bank_ref = ?, notes = ?, 
            updated_at = CURRENT_TIMESTAMP
          WHERE payment_id = ?
        `, [
          paymentData.payment_date, paymentData.party_id, paymentData.account_id || null, 
          paymentAmountNum, paymentData.payment_mode, paymentData.cheque_number || null,
          paymentData.cheque_date || null, paymentData.bank_ref || null, paymentData.notes || null,
          editingPayment.payment_id
        ]);

        // Apply new account balance
        if (paymentData.account_id) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [paymentAmountNum, paymentData.account_id]);
        }

        // 🔥 FIX: Apply new supplier balance (reduce payable)
        await db.run(`
          UPDATE suppliers 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [paymentAmountNum, paymentData.party_id]);

        alert(`Payment ${editingPayment.payment_number} updated successfully!`);
      } else {
        // CREATE NEW PAYMENT
        const paymentNumber = await db.getNextSequence('payment_out');
        
        // Save payment record
        await db.run(`
          INSERT INTO payments (
            payment_type, payment_number, payment_date, party_id, account_id, amount,
            payment_mode, cheque_number, cheque_date, bank_ref, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'payment_out', paymentNumber, paymentData.payment_date, paymentData.party_id,
          paymentData.account_id || null, paymentAmountNum, paymentData.payment_mode,
          paymentData.cheque_number || null, paymentData.cheque_date || null,
          paymentData.bank_ref || null, paymentData.notes || null
        ]);

        // 🔥 FIX: Update supplier balance (reduce payable)
        await db.run(`
          UPDATE suppliers 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [paymentAmountNum, paymentData.party_id]);

        // Update account balance (decrease cash/bank) - only if account is selected
        if (paymentData.account_id) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [paymentAmountNum, paymentData.account_id]);
        }

        alert(`Payment ${paymentNumber} recorded successfully!`);
        
        // Check if user came from purchase invoice and redirect back
        const cameFromPurchase = searchParams.get('add') === 'true' && searchParams.get('from') === 'purchase';
        if (cameFromPurchase) {
          alert('Payment saved successfully! Redirecting back to purchase invoice...');
          navigate('/purchase/bill');
          return;
        }
      }
      
      resetForm();
      await loadPayments();
      await loadSuppliers();

    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    // Check if user came from purchase invoice and redirect back
    const cameFromPurchase = searchParams.get('add') === 'true' && searchParams.get('from') === 'purchase';
    if (cameFromPurchase) {
      navigate('/purchase/bill');
      return;
    }
    
    setPaymentData({
      payment_date: new Date().toISOString().split('T')[0],
      party_id: '',
      account_id: '', 
      amount: '',
      payment_mode: 'cash',
      cheque_number: '',
      cheque_date: '',
      bank_ref: '',
      notes: ''
    });
    setSupplierSearch('');
    setSelectedSupplier(null);
    setEditingPayment(null);
    setShowForm(false);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const getTotalStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = payments.filter(payment => payment.payment_date === today);
    const todayTotal = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    return {
      totalPayments: payments.length,
      todayPayments: todayPayments.length,
      todayTotal,
      totalAmount
    };
  };

  const stats = getTotalStats();

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {editingPayment ? `Edit Payment ${editingPayment.payment_number}` : 'Record Payment Out'}
          </h1>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Date</label>
                <input
                  type="date"
                  name="payment_date"
                  value={paymentData.payment_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  value={paymentData.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              {/* Supplier Selection */}
              <div className="relative">
                <label className="block text-sm font-medium mb-1">Supplier *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search and select supplier..."
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 border border-input rounded-md"
                  />
                </div>
                
                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded-md max-h-60 overflow-auto" style={{
                    backgroundColor: '#ffffff', 
                    border: '2px solid #6b7280',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    marginTop: '4px'
                  }}>
                    {filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.supplier_id}
                        onClick={() => selectSupplier(supplier)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium">{supplier.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Balance: ₹{Math.abs(supplier.current_balance || 0).toFixed(2)} {supplier.current_balance > 0 ? 'Payable' : 'Paid'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Account *</label>
                <select
                  name="account_id"
                  value={paymentData.account_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  required
                >
                  <option value="">Select Account *</option>
                  {accounts.map(account => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Mode</label>
                <select
                  name="payment_mode"
                  value={paymentData.payment_mode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {paymentData.payment_mode === 'cheque' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cheque Number</label>
                    <input
                      type="text"
                      name="cheque_number"
                      value={paymentData.cheque_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md"
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cheque Date</label>
                    <input
                      type="date"
                      name="cheque_date"
                      value={paymentData.cheque_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md"
                    />
                  </div>
                </>
              )}

              {(paymentData.payment_mode === 'online' || paymentData.payment_mode === 'card') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Reference Number</label>
                  <input
                    type="text"
                    name="bank_ref"
                    value={paymentData.bank_ref}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="Enter reference number"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={paymentData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Payment notes..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                onClick={savePayment} 
                disabled={loading}
                className="bg-fatima-green hover:bg-fatima-green/90"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingPayment ? 'Update Payment' : 'Save Payment'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payment Out</h1>
        <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
          <Plus className="w-4 h-4 mr-2" />
          Make Payment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">{stats.totalPayments}</div>
              <div className="text-sm text-muted-foreground">Total Payments</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.todayPayments}</div>
              <div className="text-sm text-muted-foreground">Today's Payments</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">₹{stats.todayTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Today's Outflow</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">₹{stats.totalAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Outflow</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payments...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.payment_id}>
                    <TableCell className="font-medium">{payment.payment_number}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.supplier_name}</div>
                        <div className="text-sm text-muted-foreground">{payment.supplier_phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-red-600">₹{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                        {payment.payment_mode.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{payment.account_name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editPayment(payment)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deletePayment(payment)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No payments recorded yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentOut;