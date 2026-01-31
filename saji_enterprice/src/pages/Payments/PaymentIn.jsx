import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Save, FileText, Calendar, CreditCard, User, Building2, Wallet, ArrowLeft, CheckCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import db from '../../utils/database';
import showToast from '../../utils/toast';

const PaymentIn = () => {
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    party_id: '',
    payment_mode: 'cash',
    account_id: '',
    notes: ''
  });

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // New payment flow states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Edit/Delete states
  const [editingPayment, setEditingPayment] = useState(null);

  useEffect(() => {
    loadCustomers();
    loadAccounts();
    loadPayments();
  }, []);

  // Add effect to reload customers when window regains focus (when returning from other screens)
  useEffect(() => {
    const handleFocus = async () => {
      console.log('🔄 Window focused - reloading customers to update overdue status...');
      await loadCustomers();
      await refreshSelectedCustomerOverdue();
    };

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible - reloading customers...');
        await loadCustomers();
        await refreshSelectedCustomerOverdue();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedCustomer]); // Add selectedCustomer as dependency

  const loadCustomers = async () => {
    try {
      console.log('🔄 Loading customers with real-time balance calculation and overdue info...');
      
      // 🔥 FIX: First update all party balances to ensure accuracy
      const allCustomers = await db.query(`
        SELECT party_id FROM parties 
        WHERE (party_type = 'customer' OR party_type = 'both') AND is_deleted = 0
      `);
      
      // Update current balance for each customer before displaying
      for (const customer of allCustomers) {
        await db.updatePartyCurrentBalance(customer.party_id);
      }
      
      console.log('✅ Updated current balances for all customers');
      
      // Get customers with overdue invoice counts (using updated balances)
      const data = await db.query(`
        SELECT 
          p.*,
          COUNT(CASE WHEN si.balance_amount > 0 
                      AND julianday('now') - julianday(si.invoice_date) > COALESCE(p.min_due_days, 30) 
                      AND si.is_cancelled = 0 AND si.is_deleted = 0 
                 THEN 1 END) as overdue_count,
          SUM(CASE WHEN si.balance_amount > 0 
                   AND julianday('now') - julianday(si.invoice_date) > COALESCE(p.min_due_days, 30) 
                   AND si.is_cancelled = 0 AND si.is_deleted = 0 
              THEN si.balance_amount ELSE 0 END) as overdue_amount
        FROM parties p
        LEFT JOIN sales_invoices si ON p.party_id = si.party_id
        WHERE (p.party_type = 'customer' OR p.party_type = 'both')
        AND p.is_deleted = 0
        GROUP BY p.party_id, p.name, p.current_balance, p.opening_balance, p.min_due_days, 
                 p.address, p.phone, p.gst_number, p.party_type, p.balance_type, p.is_active
        ORDER BY p.name
      `);
      
      console.log('✅ Loaded customers with overdue info:', data);
      console.log('📊 Number of customers loaded:', data.length);
      
      // Log balance and overdue details for debugging
      data.forEach(customer => {
        const overdueInfo = customer.overdue_count > 0 
          ? `| OVERDUE: ${customer.overdue_count} invoices (₹${customer.overdue_amount?.toFixed(2) || '0.00'})` 
          : '';
        console.log(`👤 ${customer.name}: Outstanding ₹${Math.abs(customer.current_balance || 0).toFixed(2)} ${overdueInfo}`);
      });
      
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await db.query('SELECT * FROM accounts WHERE is_deleted = 0 ORDER BY account_name');
      setAccounts(data);
      
      // Set default account if not already set
      if (data.length > 0 && !paymentData.account_id) {
        setPaymentData(prev => ({ 
          ...prev, 
          account_id: data[0].account_id 
        }));
      }
      
      console.log('📋 Loaded accounts:', data.map(acc => ({ id: acc.account_id, name: acc.account_name })));
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          p.payment_id,
          p.payment_number,
          p.payment_date,
          p.party_id,
          p.account_id,
          p.amount,
          p.payment_mode,
          p.notes,
          pt.name as customer_name,
          pt.phone as customer_phone,
          a.account_name
        FROM payments p
        LEFT JOIN parties pt ON p.party_id = pt.party_id
        LEFT JOIN accounts a ON p.account_id = a.account_id
        WHERE p.payment_type = 'payment_in' AND p.is_deleted = 0
        ORDER BY p.payment_date DESC, p.payment_id DESC
      `);
      console.log('📋 Loaded payments with IDs:', data.map(p => ({ id: p.payment_id, number: p.payment_number })));
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

  const selectCustomer = async (customer) => {
    // 🔥 FIX: Update balance before selecting to ensure latest data
    await db.updatePartyCurrentBalance(customer.party_id);
    
    // Get the updated customer data
    const updatedCustomer = await db.get(`
      SELECT * FROM parties WHERE party_id = ?
    `, [customer.party_id]);
    
    const customerToUse = updatedCustomer || customer;
    
    setPaymentData(prev => ({ ...prev, party_id: customerToUse.party_id }));
    setSelectedCustomer(customerToUse);
    setCustomerSearch(customerToUse.name);
    setShowCustomerDropdown(false);
    setPaymentAmount(''); // Reset payment amount
    
    console.log(`👤 Selected customer: ${customerToUse.name}, Updated Balance: ₹${customerToUse.current_balance}`);
    
    // Always load overdue invoices (even if count is 0, in case it changed)
    await loadOverdueInvoices(customerToUse.party_id);
  };

  // Function to refresh selected customer's overdue data
  const refreshSelectedCustomerOverdue = async () => {
    if (selectedCustomer) {
      console.log('🔄 Refreshing overdue data for selected customer:', selectedCustomer.name);
      
      // Reload the customer's latest data including updated overdue info
      const updatedCustomerData = await db.query(`
        SELECT 
          p.*,
          COUNT(CASE WHEN si.balance_amount > 0 
                      AND julianday('now') - julianday(si.invoice_date) > COALESCE(p.min_due_days, 30) 
                      AND si.is_cancelled = 0 AND si.is_deleted = 0 
                 THEN 1 END) as overdue_count,
          SUM(CASE WHEN si.balance_amount > 0 
                   AND julianday('now') - julianday(si.invoice_date) > COALESCE(p.min_due_days, 30) 
                   AND si.is_cancelled = 0 AND si.is_deleted = 0 
              THEN si.balance_amount ELSE 0 END) as overdue_amount
        FROM parties p
        LEFT JOIN sales_invoices si ON p.party_id = si.party_id
        WHERE p.party_id = ?
        GROUP BY p.party_id
      `, [selectedCustomer.party_id]);
      
      if (updatedCustomerData.length > 0) {
        setSelectedCustomer(updatedCustomerData[0]);
        // Reload overdue invoices with latest data
        await loadOverdueInvoices(updatedCustomerData[0].party_id);
        console.log('✅ Selected customer overdue data refreshed');
      }
    }
  };
  
  // Load overdue invoices for information display
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  
  const loadOverdueInvoices = async (customerId) => {
    try {
      console.log('🔄 Loading overdue invoices for customer:', customerId);
      const invoices = await db.query(`
        SELECT 
          si.invoice_id,
          si.invoice_number,
          si.invoice_date,
          si.total_amount,
          si.balance_amount,
          p.min_due_days,
          CAST((julianday('now') - julianday(si.invoice_date)) as INTEGER) as days_since_invoice
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.party_id = ? 
        AND si.balance_amount > 0 
        AND julianday('now') - julianday(si.invoice_date) > COALESCE(p.min_due_days, 30)
        AND si.is_cancelled = 0 
        AND si.is_deleted = 0
        ORDER BY si.invoice_date ASC
      `, [customerId]);
      
      console.log('📋 Loaded overdue invoices:', invoices);
      setOverdueInvoices(invoices);
    } catch (error) {
      console.error('❌ Error loading overdue invoices:', error);
      setOverdueInvoices([]);
    }
  };

  // Simplified payment amount handler
  const handlePaymentAmountChange = (e) => {
    const amount = e.target.value;
    setPaymentAmount(amount);
  };

  // Edit payment functionality
  const editPayment = async (payment) => {
    try {
      setLoading(true);
      
      // Debug payment object
      console.log('🔍 Full payment object passed to edit:', payment);
      console.log('🔍 Payment ID specifically:', payment.payment_id);
      console.log('🔍 All payment properties:', Object.keys(payment));
      
      // Set editing mode
      setEditingPayment(payment);
      setShowForm(true);
      
      // Load customer and set form data - SIMPLE approach
      const customer = customers.find(c => c.party_id === payment.party_id);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
        setPaymentData({
          payment_date: payment.payment_date,
          party_id: payment.party_id,
          payment_mode: payment.payment_mode,
          account_id: payment.account_id,
          notes: payment.notes || ''
        });
        
        // Load the payment amount for editing
        setPaymentAmount(payment.amount.toString());
        
        console.log(`💰 Edit Mode - Loading payment: ₹${payment.amount} for customer: ${customer.name}`);

        // Load all invoices for customer (including paid ones)
        console.log('🔍 Loading invoices for edit - Payment ID:', payment.payment_id, 'Customer ID:', payment.party_id);
        
        // First, get payment details (if any)
        let paymentDetails = [];
        try {
          paymentDetails = await db.query(`
            SELECT invoice_id, amount as allocated_amount
            FROM payment_details
            WHERE payment_id = ?
          `, [payment.payment_id]);
          console.log('📋 Found payment details:', paymentDetails);
        } catch (error) {
          console.log('⚠️ Payment details not found (older payment):', error.message);
        }

        // Load all invoices for customer
        const allInvoices = await db.query(`
          SELECT 
            invoice_id,
            invoice_number,
            invoice_date,
            total_amount,
            balance_amount,
            paid_amount
          FROM sales_invoices
          WHERE party_id = ?
          AND is_cancelled = 0 AND is_deleted = 0
          ORDER BY invoice_date ASC
        `, [payment.party_id]);

        console.log('📋 All customer invoices:', allInvoices);

        // Merge payment details with invoices
        const invoicesWithAllocations = allInvoices.map(invoice => {
          const detail = paymentDetails.find(d => d.invoice_id === invoice.invoice_id);
          return {
            ...invoice,
            current_allocation: detail ? detail.allocated_amount : 0,
            // Calculate what the pending amount would be including this payment's allocation
            pending_amount: detail ? invoice.balance_amount + detail.allocated_amount : invoice.balance_amount
          };
        }).filter(inv => inv.pending_amount > 0 || inv.current_allocation > 0);

        setPendingInvoices(invoicesWithAllocations);

        // Set current allocations
        const allocations = {};
        let total = 0;
        
        if (paymentDetails.length > 0) {
          // Use detailed allocations if available
          paymentDetails.forEach(detail => {
            allocations[detail.invoice_id] = detail.allocated_amount;
            total += detail.allocated_amount;
          });
        } else {
          // For older payments without details, use transaction history to find exact allocation
          console.log('⚠️ No payment details found - checking transaction history...');
          
          try {
            // Simple approach: Look for invoices where the amount paid matches the payment amount
            console.log('🔍 Looking for invoices with matching payment amounts...');
            
            // Find invoices where the paid amount exactly or closely matches our payment
            const matchingInvoices = allInvoices.filter(inv => {
              const amountPaid = inv.total_amount - inv.balance_amount;
              const diff = Math.abs(amountPaid - payment.amount);
              return amountPaid > 0 && diff <= 1; // Exact match or within ₹1
            });
            
            console.log(`🎯 Found ${matchingInvoices.length} invoices with payments matching ₹${payment.amount}:`, matchingInvoices);
            
            if (matchingInvoices.length === 1) {
              // Perfect single match - this is likely our invoice
              const invoice = matchingInvoices[0];
              allocations[invoice.invoice_id] = payment.amount;
              total = payment.amount;
              console.log(`✅ Perfect match found: ${invoice.invoice_number} received ₹${payment.amount}`);
            } else if (matchingInvoices.length > 1) {
              // Multiple matches - try to narrow down by payment date proximity
              const paymentDate = new Date(payment.payment_date);
              const closest = matchingInvoices.reduce((best, current) => {
                const bestDiff = Math.abs(new Date(best.invoice_date) - paymentDate);
                const currentDiff = Math.abs(new Date(current.invoice_date) - paymentDate);
                return currentDiff < bestDiff ? current : best;
              });
              
              allocations[closest.invoice_id] = payment.amount;
              total = payment.amount;
              console.log(`✅ Best match by date: ${closest.invoice_number} received ₹${payment.amount}`);
            } else {
              // No exact matches - check if any invoice was fully paid with our amount
              const fullyPaidInvoices = allInvoices.filter(inv => {
                return inv.balance_amount === 0 && inv.total_amount === payment.amount;
              });
              
              if (fullyPaidInvoices.length === 1) {
                const invoice = fullyPaidInvoices[0];
                allocations[invoice.invoice_id] = payment.amount;
                total = payment.amount;
                console.log(`✅ Found fully paid invoice: ${invoice.invoice_number} = ₹${payment.amount}`);
              } else {
                console.log('❓ Could not determine exact allocation from invoice data');
              }
            }
            
          } catch (error) {
            console.error('❌ Error checking invoice patterns:', error);
          }
          
          // If no allocation found, set total for manual allocation
          if (Object.keys(allocations).length === 0) {
            total = payment.amount;
            console.log('❓ Could not determine exact allocation - user must manually allocate ₹' + payment.amount);
          }
        }
        
        setPaymentAllocations(allocations);
        setOriginalAllocations({ ...allocations });
        setTotalPayment(total);
        
        console.log('✅ Edit data loaded:', {
          allocations,
          total,
          invoiceCount: invoicesWithAllocations.length
        });
      }
    } catch (error) {
      console.error('❌ Error loading payment for edit:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete payment functionality
  const deletePayment = async (payment) => {
    if (!confirm(`Are you sure you want to delete payment ${payment.payment_number}? This will restore invoice balances and update all related records.`)) {
      return;
    }

    try {
      setLoading(true);
      console.log('🗑️ Deleting payment:', payment.payment_number);

      // Get payment details to restore invoice balances
      const paymentDetails = await db.query(`
        SELECT invoice_id, amount
        FROM payment_details
        WHERE payment_id = ?
      `, [payment.payment_id]);

      // Restore invoice balances
      for (const detail of paymentDetails) {
        await db.run(`
          UPDATE sales_invoices 
          SET balance_amount = balance_amount + ?, 
              paid_amount = paid_amount - ?
          WHERE invoice_id = ?
        `, [detail.amount, detail.amount, detail.invoice_id]);
        
        console.log(`✅ Restored invoice ${detail.invoice_id}: +₹${detail.amount}`);
      }

      // Delete payment details first
      await db.run('DELETE FROM payment_details WHERE payment_id = ?', [payment.payment_id]);

      // Reverse account balance update
      console.log(`🏦 Deleting payment - Reducing account balance: Account ${payment.account_id} - ₹${payment.amount}`);
      await db.run(`
        UPDATE accounts 
        SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `, [payment.amount, payment.account_id]);
      
      // Log account balance change
      const account = await db.get('SELECT account_name, current_balance FROM accounts WHERE account_id = ?', [payment.account_id]);
      if (account) {
        console.log(`💰 Account "${account.account_name}" balance after deletion: ₹${account.current_balance.toFixed(2)}`);
      }

      // Delete main payment record
      await db.run('DELETE FROM payments WHERE payment_id = ?', [payment.payment_id]);

      // Update party balance (real-time calculation)
      await db.updatePartyCurrentBalance(payment.party_id);

      // Reload customers to get updated balances
      await loadCustomers();

      showToast.success(`Payment ${payment.payment_number} deleted successfully!`);
      await loadPayments();

    } catch (error) {
      console.error('❌ Error deleting payment:', error);
      showToast.error('Error deleting payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const savePayment = async () => {
    if (!paymentData.party_id || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast.warning('Please select customer and enter payment amount');
      return;
    }

    const paymentAmountNum = parseFloat(paymentAmount);
    
    // 🔥 SIMPLIFIED: Skip complex validation for edits - let users edit as needed
    if (!editingPayment) {
      // Only validate for NEW payments
      await db.updatePartyCurrentBalance(paymentData.party_id);
      
      const freshCustomer = await db.get(`
        SELECT party_id, name, current_balance 
        FROM parties 
        WHERE party_id = ?
      `, [paymentData.party_id]);
      
      if (!freshCustomer) {
        showToast.error('Customer not found. Please try again.');
        return;
      }
      
      const maxPayment = Math.abs(freshCustomer.current_balance || 0);
      
      if (paymentAmountNum > maxPayment) {
        showToast.warning(`Payment amount ₹${paymentAmountNum.toFixed(2)} cannot exceed outstanding balance of ₹${maxPayment.toFixed(2)} for ${freshCustomer.name}`);
        return;
      }
    } else {
      console.log(`🔍 EDIT MODE: Skipping validation - allowing user to edit payment amount`);
    }

    try {
      setLoading(true);
      
      if (editingPayment) {
        // UPDATE EXISTING PAYMENT
        console.log('📝 Updating payment:', editingPayment.payment_number);
        console.log(`   Original amount: ₹${editingPayment.amount}, New amount: ₹${paymentAmountNum}`);
        
        // 🔥 FIX: Calculate the difference for party balance adjustment
        const amountDifference = paymentAmountNum - editingPayment.amount;
        console.log(`   Amount difference: ₹${amountDifference} (${amountDifference > 0 ? 'increase' : 'decrease'})`);
        
        // Reverse original account balance
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [editingPayment.amount, editingPayment.account_id]);

        // Update main payment record
        await db.run(`
          UPDATE payments SET
            payment_date = ?, party_id = ?, account_id = ?, amount = ?,
            payment_mode = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE payment_id = ?
        `, [
          paymentData.payment_date, paymentData.party_id, paymentData.account_id, 
          paymentAmountNum, paymentData.payment_mode, paymentData.notes || null,
          editingPayment.payment_id
        ]);

        // Update new account balance
        console.log(`🏦 EDIT PAYMENT - Adding to new account balance: Account ${paymentData.account_id} + ₹${paymentAmountNum}`);
        
        // Get new account balance before addition
        const newAccountBefore = await db.get('SELECT account_name, current_balance FROM accounts WHERE account_id = ?', [paymentData.account_id]);
        console.log(`   - Account "${newAccountBefore?.account_name}" balance BEFORE: ₹${newAccountBefore?.current_balance || 'unknown'}`);
        
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [paymentAmountNum, paymentData.account_id]);
        
        // Get new account balance after addition
        const newAccountAfter = await db.get('SELECT account_name, current_balance FROM accounts WHERE account_id = ?', [paymentData.account_id]);
        console.log(`   - Account "${newAccountAfter?.account_name}" balance AFTER: ₹${newAccountAfter?.current_balance || 'unknown'}`);
        console.log(`   - ✅ Account update complete: +₹${paymentAmountNum}`);

        // Payment record has been updated - party balance will be recalculated from all transactions
        console.log('ℹ️ Payment record updated - party balance will be recalculated from all transactions');

        showToast.success(`Payment ${editingPayment.payment_number} updated successfully!`);

      } else {
        // CREATE NEW PAYMENT
        const paymentNumber = await db.getNextSequence('payment_in');
        console.log('💰 Creating new payment:', paymentNumber);

        // Insert main payment record
        await db.run(`
          INSERT INTO payments (
            payment_type, payment_number, payment_date, party_id, account_id, amount,
            payment_mode, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          'payment_in', paymentNumber, paymentData.payment_date, paymentData.party_id,
          paymentData.account_id, paymentAmountNum, paymentData.payment_mode,
          paymentData.notes || null
        ]);

        // Update account balance
        console.log(`🏦 NEW PAYMENT - Adding to account balance: Account ${paymentData.account_id} + ₹${paymentAmountNum}`);
        
        // Get account balance before addition
        const accountBefore = await db.get('SELECT account_name, current_balance FROM accounts WHERE account_id = ?', [paymentData.account_id]);
        console.log(`   - Account "${accountBefore?.account_name}" balance BEFORE: ₹${accountBefore?.current_balance || 'unknown'}`);
        
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [paymentAmountNum, paymentData.account_id]);
        
        // Get account balance after addition
        const accountAfter = await db.get('SELECT account_name, current_balance FROM accounts WHERE account_id = ?', [paymentData.account_id]);
        console.log(`   - Account "${accountAfter?.account_name}" balance AFTER: ₹${accountAfter?.current_balance || 'unknown'}`);
        console.log(`   - ✅ Account update complete: +₹${paymentAmountNum}`);

        showToast.success(`Payment ${paymentNumber} of ₹${paymentAmountNum.toFixed(2)} recorded successfully!`);
      }

      // 🔥 FIX: Always recalculate party balance from scratch after any payment change
      // This ensures accuracy for both NEW payments and EDITS
      await db.updatePartyCurrentBalance(paymentData.party_id);
      console.log('✅ Recalculated party balance from all transactions');

      // Reload customers to get updated balances
      await loadCustomers();
      
      // Reload accounts to see updated bank balances
      await loadAccounts();
      
      // Update the selected customer's balance in real-time
      if (selectedCustomer) {
        const updatedCustomer = await db.query(`
          SELECT party_id, name, current_balance, phone 
          FROM parties 
          WHERE party_id = ?
        `, [paymentData.party_id]);
        
        if (updatedCustomer.length > 0) {
          console.log(`💰 Updated customer balance: ${updatedCustomer[0].name} = ₹${updatedCustomer[0].current_balance}`);
          setSelectedCustomer(updatedCustomer[0]);
        }
      }

      resetForm();
      await loadPayments();

    } catch (error) {
      console.error('❌ Error saving payment:', error);
      showToast.error('Error saving payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentData({
      payment_date: new Date().toISOString().split('T')[0],
      party_id: '',
      account_id: accounts.length > 0 ? accounts[0].account_id : '',
      payment_mode: 'cash',
      notes: ''
    });
    setCustomerSearch('');
    setSelectedCustomer(null);
    setPaymentAmount('');
    setOverdueInvoices([]);
    setEditingPayment(null);
    setShowForm(false);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
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
            {editingPayment ? `Edit Payment ${editingPayment.payment_number}` : 'Record Payment In'}
          </h1>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        {/* Step 1: Payment Date and Customer */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

              <div className="relative">
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search and select customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 border border-input rounded-md"
                  />
                </div>
                
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded-md max-h-60 overflow-auto bg-white border shadow-lg">
                    {filteredCustomers.map((customer) => {
                      const hasOverdue = customer.overdue_count > 0;
                      return (
                        <div
                          key={customer.party_id}
                          onClick={() => selectCustomer(customer)}
                          className={`px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            hasOverdue ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{customer.name}</div>
                            {hasOverdue && (
                              <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                                OVERDUE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Outstanding: ₹{Math.abs(customer.current_balance || 0).toFixed(2)}
                            {hasOverdue && (
                              <span className="ml-2 text-red-600 font-medium">
                                • {customer.overdue_count} overdue invoice{customer.overdue_count > 1 ? 's' : ''} 
                                (₹{customer.overdue_amount?.toFixed(2) || '0.00'})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Payment Amount */}
        {selectedCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Details for {selectedCustomer.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Outstanding Balance Display */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Current Outstanding Balance</label>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-2xl font-bold text-red-600">
                      ₹{Math.abs(selectedCustomer.current_balance || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-red-600">
                      {selectedCustomer.current_balance < 0 ? 'Amount Due' : 'Credit Balance'}
                    </div>
                  </div>
                </div>
                
                {/* Payment Amount Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Payment Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      max={Math.abs(selectedCustomer.current_balance || 0)}
                      value={paymentAmount}
                      onChange={handlePaymentAmountChange}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium text-lg"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Maximum: ₹{Math.abs(selectedCustomer.current_balance || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              
              {/* Overdue Invoices Information */}
              {overdueInvoices.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-red-800">
                      ⚠️ Overdue Invoices ({overdueInvoices.length})
                    </h4>
                    <span className="text-red-800 font-bold">
                      Total: ₹{overdueInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {overdueInvoices.map((invoice) => {
                      const daysOverdue = invoice.days_since_invoice - (invoice.min_due_days || 30);
                      return (
                        <div key={invoice.invoice_id} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                          <div>
                            <span className="font-medium">{invoice.invoice_number}</span>
                            <span className="text-gray-600 ml-2">
                              ({new Date(invoice.invoice_date).toLocaleDateString()})
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-red-600 font-medium">₹{invoice.balance_amount.toFixed(2)}</div>
                            <div className="text-xs text-red-500">{daysOverdue} days overdue</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-red-600">
                    <strong>Note:</strong> This payment will be applied to overall outstanding balance.
                  </div>
                </div>
              )}
              
              {/* Payment Summary */}
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="mt-6 p-4 bg-green-50 rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Outstanding:</span>
                      <span className="font-semibold">₹{Math.abs(selectedCustomer.current_balance || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Amount:</span>
                      <span className="font-semibold text-green-600">₹{parseFloat(paymentAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Balance After Payment:</span>
                      <span className="font-semibold text-fatima-green">
                        {editingPayment ? (
                          // 🔥 SIMPLIFIED: For EDIT mode, show "Will be recalculated"
                          <span className="text-orange-600 italic">Will be recalculated after save</span>
                        ) : (
                          // For NEW payments, use the simple calculation
                          `₹${Math.abs((selectedCustomer.current_balance || 0) - parseFloat(paymentAmount)).toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Method and Notes */}
        {paymentAmount && parseFloat(paymentAmount) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Mode</label>
                  <select
                    name="payment_mode"
                    value={paymentData.payment_mode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Account</label>
                  <select
                    name="account_id"
                    value={paymentData.account_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  >
                    {accounts.map(account => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={paymentData.notes}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Payment notes..."
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={savePayment} 
                  disabled={loading || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="bg-fatima-green hover:bg-fatima-green/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingPayment ? `Update Payment (₹${parseFloat(paymentAmount || 0).toFixed(2)})` : `Record Payment (₹${parseFloat(paymentAmount || 0).toFixed(2)})`}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payment In</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              console.log('🔄 Manual refresh triggered by user');
              await loadCustomers();
              await loadAccounts();
              await loadPayments();
              // Also refresh selected customer overdue data if any customer is selected
              await refreshSelectedCustomerOverdue();
            }}
            title="Refresh data and update overdue calculations"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
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
              <div className="text-2xl font-bold text-green-600">{stats.todayPayments}</div>
              <div className="text-sm text-muted-foreground">Today's Payments</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">₹{stats.todayTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Today's Collection</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">₹{stats.totalAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Collection</div>
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
                  <TableHead>Customer</TableHead>
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
                        <div className="font-medium">{payment.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{payment.customer_phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">₹{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-blue-800">
                        {payment.payment_mode.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{payment.account_name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editPayment(payment)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePayment(payment)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
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

export default PaymentIn;