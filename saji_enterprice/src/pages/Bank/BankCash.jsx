import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Save, Edit, Trash2, Wallet, Building2, Eye, Minus } from 'lucide-react';
import db from '../../utils/database';

const BankCash = () => {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [accountHistory, setAccountHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [accountsPerPage] = useState(10);
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'add', // 'add' or 'reduce'
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Account form state
  const [accountData, setAccountData] = useState({
    account_name: '',
    account_type: 'cash',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    opening_balance: ''
  });

  // Database test function
  const testDatabase = async () => {
    console.log('🧪 PROGRAMMATIC DATABASE TEST STARTING...');
    console.log('===========================================');
    
    try {
      // Test 1: Check payment_transactions table
      console.log('\n1️⃣ Testing payment_transactions table...');
      try {
        const paymentCount = await db.query('SELECT COUNT(*) as count FROM payment_transactions');
        console.log(`✅ payment_transactions table exists with ${paymentCount[0]?.count || 0} records`);
        
        if (paymentCount[0]?.count > 0) {
          const samplePayments = await db.query('SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 3');
          console.log('📋 Sample payment transactions:');
          samplePayments.forEach((payment, index) => {
            console.log(`   ${index + 1}. Account: ${payment.account_id}, Amount: ₹${payment.amount}, Type: ${payment.payment_type}, Date: ${payment.payment_date}`);
          });
        }
      } catch (error) {
        console.log('❌ payment_transactions table error:', error.message);
      }

      // Test 2: Check sales invoices with payments
      console.log('\n2️⃣ Testing sales invoices with payments...');
      try {
        const salesCount = await db.query(`
          SELECT COUNT(*) as count FROM sales_invoices 
          WHERE payment_type = 'cash' AND account_id IS NOT NULL AND is_deleted = 0
        `);
        console.log(`✅ Sales invoices with payments: ${salesCount[0]?.count || 0}`);
        
        if (salesCount[0]?.count > 0) {
          const sampleSales = await db.query(`
            SELECT invoice_number, account_id, total_amount, invoice_date 
            FROM sales_invoices 
            WHERE payment_type = 'cash' AND account_id IS NOT NULL AND is_deleted = 0
            ORDER BY created_at DESC LIMIT 3
          `);
          console.log('📋 Sample sales with payments:');
          sampleSales.forEach((sale, index) => {
            console.log(`   ${index + 1}. Invoice: ${sale.invoice_number}, Account: ${sale.account_id}, Amount: ₹${sale.total_amount}, Date: ${sale.invoice_date}`);
          });
        }
      } catch (error) {
        console.log('❌ Sales invoices test error:', error.message);
      }

      // Test 3: Check accounts
      console.log('\n3️⃣ Testing accounts table...');
      try {
        const accountsList = await db.query('SELECT account_id, account_name, account_type, current_balance FROM accounts WHERE is_deleted = 0');
        console.log(`✅ Found ${accountsList.length} accounts:`);
        accountsList.forEach((account, index) => {
          console.log(`   ${index + 1}. ID: ${account.account_id}, Name: ${account.account_name}, Balance: ₹${account.current_balance}`);
        });
      } catch (error) {
        console.log('❌ Accounts test error:', error.message);
      }

      // Test 4: Check table existence
      console.log('\n4️⃣ Testing table existence...');
      try {
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('payment_transactions', 'account_transactions', 'sales_invoices', 'accounts')");
        console.log('✅ Tables found:', tables.map(t => t.name).join(', '));
      } catch (error) {
        console.log('❌ Table existence test error:', error.message);
      }

      console.log('\n🎯 TEST COMPLETED! Check the output above.');
      
    } catch (error) {
      console.error('❌ Database test failed:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
    // Run database test automatically on component load
    setTimeout(() => testDatabase(), 1000); // Run after 1 second
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await db.query('SELECT * FROM accounts WHERE is_deleted = 0 ORDER BY account_type, account_name');
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountTransactions = async (accountId) => {
    try {
      setLoading(true);
      console.log('🔍 Loading enhanced transaction history for account:', accountId);
      
      // Ensure payment tables exist
      await db.createPaymentTables();
      
      // Get NEW payment transactions (from sales invoice payments, etc.)
      console.log('💳 Loading payment transactions...');
      
      // First, let's see what columns actually exist
      try {
        const tableStructure = await db.query("PRAGMA table_info(payment_transactions)");
        console.log('📋 payment_transactions table structure:', tableStructure.map(col => col.name));
      } catch (e) {
        console.log('⚠️ Could not get table structure:', e.message);
      }
      
      // Simple query first to see what data we have
      const simplePaymentTxns = await db.query(`
        SELECT * FROM payment_transactions
        WHERE account_id = ? AND is_deleted = 0
        ORDER BY payment_date DESC
        LIMIT 3
      `, [accountId]);
      console.log('📋 Raw payment transactions data:', simplePaymentTxns);
      
      // Build transaction array based on available columns
      const newPaymentTxns = simplePaymentTxns.map(payment => ({
        date: payment.payment_date,
        reference: payment.reference_number || `PT-${payment.payment_id}`,
        type: payment.payment_type === 'payment_in' ? 'Sales Payment' : 'Payment Out',
        credit: payment.payment_type === 'payment_in' ? payment.amount : 0,
        debit: payment.payment_type === 'payment_out' ? payment.amount : 0,
        party_name: payment.party_name || payment.description || 'Direct Payment'
      }));
      console.log('💰 New payment transactions found:', newPaymentTxns.length);

      // Get account transactions (Add/Reduce money operations)
      console.log('🏦 Loading account transactions (Add/Reduce operations)...');
      const accountTxns = await db.query(`
        SELECT 
          transaction_date as date,
          COALESCE('ACC-' || transaction_id, 'Manual') as reference,
          CASE 
            WHEN transaction_type = 'credit' THEN 'Add Money'
            WHEN transaction_type = 'debit' THEN 'Reduce Money'
            ELSE transaction_type
          END as type,
          CASE 
            WHEN transaction_type = 'credit' THEN amount
            ELSE 0
          END as credit,
          CASE 
            WHEN transaction_type = 'debit' THEN amount
            ELSE 0
          END as debit,
          COALESCE(description, 'Manual Balance Adjustment') as party_name
        FROM account_transactions
        WHERE account_id = ? 
        ORDER BY transaction_date DESC, created_at DESC
      `, [accountId]);
      console.log('🏦 Account transactions (Add/Reduce) found:', accountTxns.length);

      // Get OLD payment transactions (legacy payments table)
      const oldPaymentTxns = await db.query(`
        SELECT 
          p.payment_date as date,
          p.payment_number as reference,
          CASE 
            WHEN p.payment_type = 'payment_in' THEN 'Payment In'
            ELSE 'Payment Out'
          END as type,
          CASE 
            WHEN p.payment_type = 'payment_in' THEN p.amount
            ELSE 0
          END as credit,
          CASE 
            WHEN p.payment_type = 'payment_out' THEN p.amount
            ELSE 0
          END as debit,
          pt.name as party_name
        FROM payments p
        LEFT JOIN parties pt ON p.party_id = pt.party_id
        WHERE p.account_id = ? AND p.is_deleted = 0
        ORDER BY p.payment_date DESC, p.payment_id DESC
      `, [accountId]);

      const salesTxns = await db.query(`
        SELECT 
          si.invoice_date as date,
          si.invoice_number as reference,
          'Sales Invoice' as type,
          si.total_amount as credit,
          0 as debit,
          p.name as party_name
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.payment_type = 'cash' AND si.account_id = ? AND si.is_deleted = 0
        ORDER BY si.invoice_date DESC
      `, [accountId]);

      const purchaseTxns = await db.query(`
        SELECT 
          pi.bill_date as date,
          pi.bill_number as reference,
          'Purchase Bill' as type,
          0 as credit,
          pi.paid_amount as debit,
          s.name as party_name
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON pi.supplier_id = s.supplier_id
        WHERE pi.paid_amount > 0 AND pi.account_id = ? AND pi.is_deleted = 0
        ORDER BY pi.bill_date DESC
      `, [accountId]);

      const expenseTxns = await db.query(`
        SELECT 
          e.expense_date as date,
          e.expense_number as reference,
          'Expense' as type,
          0 as credit,
          e.amount as debit,
          e.vendor_name as party_name
        FROM expenses e
        WHERE e.account_id = ? AND e.is_deleted = 0
        ORDER BY e.expense_date DESC
      `, [accountId]);

      // Combine and sort all transactions
      const allTransactions = [
        ...newPaymentTxns,  // NEW: Sales invoice payments
        ...accountTxns,     // NEW: Add/Reduce money operations
        ...oldPaymentTxns,  // OLD: Legacy payment system
        ...salesTxns,
        ...purchaseTxns,
        ...expenseTxns
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('🎯 Total transactions loaded:', allTransactions.length);
      console.log('📊 Transaction breakdown:', {
        newPayments: newPaymentTxns.length,
        accountTransactions: accountTxns.length,
        oldPayments: oldPaymentTxns.length,
        sales: salesTxns.length,
        purchases: purchaseTxns.length,
        expenses: expenseTxns.length
      });

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAccountData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const saveAccount = async () => {
    if (!accountData.account_name) {
      alert('Please enter account name');
      return;
    }

    try {
      setLoading(true);
      
      const openingBalance = parseFloat(accountData.opening_balance) || 0;

      if (editingAccount) {
        // Update existing account
        await db.run(`
          UPDATE accounts SET 
            account_name = ?, account_type = ?, bank_name = ?, account_number = ?, 
            ifsc_code = ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [
          accountData.account_name, accountData.account_type, 
          accountData.bank_name || null, accountData.account_number || null,
          accountData.ifsc_code || null, editingAccount.account_id
        ]);

        alert('Account updated successfully!');
      } else {
        // Create new account
        await db.run(`
          INSERT INTO accounts (
            account_name, account_type, bank_name, account_number, ifsc_code,
            opening_balance, current_balance
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          accountData.account_name, accountData.account_type,
          accountData.bank_name || null, accountData.account_number || null,
          accountData.ifsc_code || null, openingBalance, openingBalance
        ]);

        alert('Account created successfully!');
      }


      resetForm();
      await loadAccounts();

    } catch (error) {
      console.error('Error saving account:', error);
      alert('Error saving account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const editAccount = (account) => {
    setEditingAccount(account);
    setAccountData({
      account_name: account.account_name,
      account_type: account.account_type,
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      ifsc_code: account.ifsc_code || '',
      opening_balance: account.opening_balance
    });
    setShowForm(true);
  };

  const deleteAccount = async (accountId) => {
    if (window.confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      try {
        await db.run('UPDATE accounts SET is_deleted = 1 WHERE account_id = ?', [accountId]);
        await loadAccounts();
        alert('Account deleted successfully');
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account: ' + error.message);
      }
    }
  };

  const viewTransactions = async (account) => {
    setSelectedAccount(account);
    await loadAccountTransactions(account.account_id);
    setShowTransactions(true);
  };

  const handleAdjustBalance = async () => {
    console.log('handleAdjustBalance called');
    console.log('Selected account:', selectedAccount);
    console.log('Adjustment data:', adjustmentData);

    if (!selectedAccount || !adjustmentData.amount) {
      alert('Please enter an amount');
      return;
    }

    if (parseFloat(adjustmentData.amount) <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      const amount = parseFloat(adjustmentData.amount);
      const finalAmount = adjustmentData.type === 'add' ? amount : -amount;

      console.log('Processing adjustment:', {amount, finalAmount, type: adjustmentData.type});

      // Get current balance before update
      const currentAccount = await db.get('SELECT current_balance FROM accounts WHERE account_id = ?', [selectedAccount.account_id]);
      const balanceBefore = currentAccount.current_balance;
      const balanceAfter = balanceBefore + finalAmount;

      // Update account balance
      await db.run(`
        UPDATE accounts 
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `, [finalAmount, selectedAccount.account_id]);

      console.log('Balance updated successfully');

      // Record transaction in account_transactions table
      try {
        await db.run(`
          INSERT INTO account_transactions (
            account_id, transaction_type, amount, balance_before, balance_after,
            transaction_date, description, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          selectedAccount.account_id,
          adjustmentData.type === 'add' ? 'credit' : 'debit',
          amount,
          balanceBefore,
          balanceAfter,
          adjustmentData.date,
          adjustmentData.reason || `Manual ${adjustmentData.type === 'add' ? 'deposit' : 'withdrawal'}: ${adjustmentData.reason || 'Balance adjustment'}`
        ]);

        console.log('✅ Transaction recorded in account_transactions table');
      } catch (txnError) {
        console.log('⚠️ Could not record transaction (table might not exist):', txnError.message);
        // Continue anyway - balance was updated successfully
      }

      // 🔥 FIX: Record in payment_transactions table for complete audit trail (like BankManagement.jsx does)
      try {
        await db.recordPaymentTransaction({
          reference_type: 'manual_adjustment',
          reference_id: null,
          reference_number: `ADJ-${Date.now()}`,
          party_id: null,
          account_id: selectedAccount.account_id,
          payment_type: adjustmentData.type === 'add' ? 'payment_in' : 'payment_out',
          amount: amount,
          payment_date: adjustmentData.date,
          payment_method: 'manual_adjustment',
          description: `Manual balance adjustment: ${adjustmentData.reason}`,
          notes: `${adjustmentData.type === 'add' ? 'Money added' : 'Money reduced'} by admin`
        });

        console.log('✅ Payment transaction recorded - now will appear in Payment History');
      } catch (paymentError) {
        console.log('⚠️ Could not record payment transaction:', paymentError.message);
        // Continue anyway - balance was updated successfully
      }

      alert(`₹${amount.toLocaleString()} ${adjustmentData.type === 'add' ? 'added to' : 'deducted from'} ${selectedAccount.account_name} successfully!`);
      
      setShowAdjustmentModal(false);
      resetAdjustmentForm();
      await loadAccounts(); // Refresh balances
      
    } catch (error) {
      console.error('Error adjusting balance:', error);
      alert('Error adjusting balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAdjustmentForm = () => {
    setAdjustmentData({
      type: 'add',
      amount: '',
      reason: '',
      date: new Date().toISOString().split('T')[0]
    });
    setSelectedAccount(null);
  };

  const openAdjustmentModal = (account, type) => {
    setSelectedAccount(account);
    setAdjustmentData(prev => ({ ...prev, type }));
    setShowAdjustmentModal(true);
  };

  const openHistoryModal = async (account) => {
    setSelectedAccount(account);
    setAccountHistory([]);
    setShowHistoryModal(true);

    try {
      console.log('🔍 Starting transaction history load for account:', account);
      
      // QUICK DEBUG: Let's check what's in the database first
      console.log('🚀 QUICK DEBUG: Checking database directly...');
      try {
        const directPaymentCheck = await db.query(`
          SELECT COUNT(*) as count FROM payment_transactions WHERE account_id = ? AND is_deleted = 0
        `, [account.account_id]);
        console.log(`💳 Direct payment check for account ${account.account_id}:`, directPaymentCheck[0]?.count || 0);
        
        const directAccountCheck = await db.query(`
          SELECT COUNT(*) as count FROM account_transactions WHERE account_id = ?
        `, [account.account_id]);
        console.log(`🏦 Direct account check for account ${account.account_id}:`, directAccountCheck[0]?.count || 0);
        
        // Check if tables exist at all
        const paymentTableExists = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_transactions'");
        const accountTableExists = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='account_transactions'");
        console.log('📊 Table existence check:', {
          payment_transactions: paymentTableExists.length > 0,
          account_transactions: accountTableExists.length > 0
        });
        
      } catch (debugError) {
        console.error('❌ Quick debug failed:', debugError);
      }
      
      // Ensure payment tables exist first
      console.log('⚡ Creating payment tables...');
      const tablesCreated = await db.createPaymentTables();
      console.log('📊 Tables creation result:', tablesCreated);
      
      // Debug: Check if tables actually exist by running a simple query
      console.log('🔎 Testing table existence...');
      try {
        const testPayments = await db.query('SELECT COUNT(*) as count FROM payment_transactions');
        console.log('💳 Payment transactions table exists, count:', testPayments[0]?.count || 0);
      } catch (error) {
        console.error('❌ Payment transactions table issue:', error);
      }
      
      try {
        const testAccounts = await db.query('SELECT COUNT(*) as count FROM account_transactions');
        console.log('🏦 Account transactions table exists, count:', testAccounts[0]?.count || 0);
      } catch (error) {
        console.error('❌ Account transactions table issue:', error);
      }
      
      // Debug: Check all payment transactions for this account
      console.log('🔍 Searching for payment transactions for account_id:', account.account_id);
      const allPayments = await db.query(`
        SELECT * FROM payment_transactions 
        WHERE account_id = ? AND is_deleted = 0
        ORDER BY payment_date DESC
      `, [account.account_id]);
      console.log('💰 Direct payment query result:', allPayments);
      
      // Debug: Check all account transactions for this account
      console.log('🔍 Searching for account transactions for account_id:', account.account_id);
      const allAccountTxns = await db.query(`
        SELECT * FROM account_transactions 
        WHERE account_id = ?
        ORDER BY transaction_date DESC
      `, [account.account_id]);
      console.log('🏦 Direct account query result:', allAccountTxns);
      
      // Try the original method calls
      console.log('📞 Calling getPaymentHistory...');
      const paymentHistory = await db.getPaymentHistory({ account_id: account.account_id });
      console.log('📋 Payment history result:', paymentHistory);
      
      console.log('📞 Calling getAccountTransactionHistory...');
      const accountHistory = await db.getAccountTransactionHistory(account.account_id);
      console.log('📋 Account history result:', accountHistory);
      
      // Combine and format the history
      const combinedHistory = [];
      
      // Add payment transactions (from sales invoice payments)
      if (paymentHistory && paymentHistory.length > 0) {
        console.log('✅ Adding payment transactions to history');
        paymentHistory.forEach(payment => {
          combinedHistory.push({
            transaction_date: payment.payment_date,
            transaction_type: payment.payment_type === 'payment_in' ? 'credit' : 'debit',
            amount: payment.amount,
            description: payment.description || `${payment.transaction_category} - ${payment.reference_number || ''}`,
            reference_type: payment.reference_type,
            reference_id: payment.reference_id,
            party_name: payment.party_name,
            created_at: payment.created_at
          });
        });
      }
      
      // Add account transactions (balance adjustments, etc.)
      if (accountHistory && accountHistory.length > 0) {
        console.log('✅ Adding account transactions to history');
        accountHistory.forEach(txn => {
          combinedHistory.push({
            transaction_date: txn.transaction_date,
            transaction_type: txn.transaction_type,
            amount: txn.amount,
            balance_before: txn.balance_before,
            balance_after: txn.balance_after,
            description: txn.description,
            reference_type: txn.reference_type,
            reference_id: txn.reference_id,
            created_at: txn.created_at
          });
        });
      }
      
      // Sort by date (newest first)
      combinedHistory.sort((a, b) => {
        const dateA = new Date(a.transaction_date + ' ' + (a.created_at || '00:00:00'));
        const dateB = new Date(b.transaction_date + ' ' + (b.created_at || '00:00:00'));
        return dateB - dateA;
      });
      
      console.log('🎯 Final combined transaction history:', combinedHistory);
      setAccountHistory(combinedHistory);
      
      if (combinedHistory.length === 0) {
        console.log('⚠️ No transaction history found');
      } else {
        console.log(`✅ Loaded ${combinedHistory.length} transactions`);
      }
      
    } catch (error) {
      console.error('❌ Error loading transaction history:', error);
      setAccountHistory([]);
    }
  };

  const resetForm = () => {
    setAccountData({
      account_name: '',
      account_type: 'cash',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      opening_balance: ''
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const getTotalStats = () => {
    const cashAccounts = accounts.filter(acc => acc.account_type === 'cash');
    const bankAccounts = accounts.filter(acc => acc.account_type === 'bank');
    
    const totalCash = cashAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
    const totalBank = bankAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
    
    return {
      totalAccounts: accounts.length,
      cashAccounts: cashAccounts.length,
      bankAccounts: bankAccounts.length,
      totalCash,
      totalBank,
      totalBalance: totalCash + totalBank
    };
  };

  const stats = getTotalStats();

  // Pagination calculations
  const indexOfLastAccount = currentPage * accountsPerPage;
  const indexOfFirstAccount = indexOfLastAccount - accountsPerPage;
  const currentAccounts = accounts.slice(indexOfFirstAccount, indexOfLastAccount);
  const totalPages = Math.ceil(accounts.length / accountsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (showTransactions && selectedAccount) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedAccount.account_name}</h1>
            <p className="text-muted-foreground">Account Transactions</p>
          </div>
          <Button variant="outline" onClick={() => setShowTransactions(false)}>
            Back to Accounts
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction History</CardTitle>
              <div className="text-right">
                <div className="text-2xl font-bold text-fatima-green">
                  ₹{selectedAccount.current_balance.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Current Balance</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{txn.reference}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-blue-800">
                          {txn.type}
                        </span>
                      </TableCell>
                      <TableCell>{txn.party_name || '-'}</TableCell>
                      <TableCell className="text-red-600">
                        {txn.debit > 0 ? `₹${txn.debit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {txn.credit > 0 ? `₹${txn.credit.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transactions found
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
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {editingAccount ? 'Edit Account' : 'Add Account'}
          </h1>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  name="account_name"
                  value={accountData.account_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter account name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Account Type</label>
                <select
                  name="account_type"
                  value={accountData.account_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              {accountData.account_type === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bank Name</label>
                    <input
                      type="text"
                      name="bank_name"
                      value={accountData.bank_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md"
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Account Number</label>
                    <input
                      type="text"
                      name="account_number"
                      value={accountData.account_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md"
                      placeholder="Enter account number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc_code"
                      value={accountData.ifsc_code}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md"
                      placeholder="Enter IFSC code"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Opening Balance</label>
                <input
                  type="number"
                  name="opening_balance"
                  value={accountData.opening_balance}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                onClick={saveAccount} 
                disabled={loading}
                className="bg-fatima-green hover:bg-fatima-green/90"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingAccount ? 'Update Account' : 'Save Account'}
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
        <h1 className="text-2xl font-bold text-foreground">Bank & Cash</h1>
        <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Modern Stats Cards with Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Accounts Card */}
        <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-0 shadow-md overflow-hidden">
          <div className="h-1 w-full bg-fatima-green opacity-20 shadow-sm"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-fatima-green group-hover:text-blue-700 transition-colors">
                  {stats.totalAccounts}
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mt-1">
                  Total Accounts
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-6 h-6 text-fatima-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Balance Card */}
        <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-0 shadow-md overflow-hidden">
          <div className="h-1 w-full bg-green-600 opacity-20 shadow-sm"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-green-600 group-hover:text-green-700 transition-colors">
                  ₹{stats.totalCash.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mt-1">
                  Cash Balance
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 group-hover:scale-110 transition-transform duration-300">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Balance Card */}
        <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-0 shadow-md overflow-hidden">
          <div className="h-1 w-full bg-blue-600 opacity-20 shadow-sm"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-fatima-green group-hover:text-blue-700 transition-colors">
                  ₹{stats.totalBank.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mt-1">
                  Bank Balance
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-6 h-6 text-fatima-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Balance Card */}
        <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-0 shadow-md overflow-hidden">
          <div className="h-1 w-full bg-fatima-green opacity-20 shadow-sm"></div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-fatima-green group-hover:text-amber-700 transition-colors">
                  ₹{stats.totalBalance.toLocaleString('en-IN')}
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mt-1">
                  Total Balance
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-fatima-green" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No accounts found</h3>
                  <p>Create your first account to get started.</p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          currentAccounts.map((account, index) => (
            <Card key={account.account_id} className="hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {account.account_type === 'cash' ? (
                      <div className="p-2 rounded-lg bg-green-100">
                        <Wallet className="w-6 h-6 text-green-600" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-green-100">
                        <Building2 className="w-6 h-6 text-fatima-green" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {account.account_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">
                        {account.account_type} Account • #{indexOfFirstAccount + index + 1}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    account.account_type === 'cash' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-green-100 text-blue-800'
                  }`}>
                    {account.account_type.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Balance Information */}
                <div className="space-y-3">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                    <p className={`text-2xl font-bold ${
                      account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {account.current_balance < 0 ? '-' : ''}₹{Math.abs(account.current_balance).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-center mt-2">
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {/* First Row: Add and Reduce with equal width */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openAdjustmentModal(account, 'add')}
                      className="flex-1 p-1.5 rounded text-white text-xs font-medium flex items-center justify-center gap-1 bg-fatima-green hover:bg-fatima-green/90 transition-colors"
                      title="Add Money"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                    <button
                      onClick={() => openAdjustmentModal(account, 'reduce')}
                      className="flex-1 p-1.5 rounded text-white text-xs font-medium flex items-center justify-center gap-1 bg-fatima-green hover:bg-fatima-green/90 transition-colors"
                      title="Reduce Money"
                    >
                      <Minus className="w-3 h-3" />
                      Reduce
                    </button>
                  </div>
                  {/* Second Row: View, Edit, Delete with equal width */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => viewTransactions(account)}
                      className="flex-1 p-1.5 rounded text-white text-xs font-medium flex items-center justify-center gap-1 bg-fatima-green hover:bg-fatima-green/90 transition-colors"
                      title="View Transactions"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => editAccount(account)}
                      className="flex-1 p-1.5 rounded text-white text-xs font-medium flex items-center justify-center gap-1 bg-fatima-green hover:bg-fatima-green/90 transition-colors"
                      title="Edit Account"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAccount(account.account_id)}
                      className="flex-1 p-1.5 rounded text-white text-xs font-medium flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {accounts.length > accountsPerPage && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {indexOfFirstAccount + 1} to {Math.min(indexOfLastAccount, accounts.length)} of {accounts.length} accounts
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex space-x-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => paginate(i + 1)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentPage === i + 1
                      ? 'bg-fatima-green text-white'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0}}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative z-60">
            <h3 className="text-lg font-bold mb-4">
              {adjustmentData.type === 'add' ? 'Add Money' : 'Reduce Money'} - {selectedAccount?.account_name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  value={adjustmentData.amount}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter amount"
                  step="0.01"
                  min="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="e.g., Bank interest, Withdrawal, Initial deposit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={adjustmentData.date}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                />
              </div>

              {adjustmentData.amount && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    This will {adjustmentData.type === 'add' ? 'add ₹' : 'reduce ₹'}{adjustmentData.amount} 
                    {adjustmentData.type === 'add' ? ' to ' : ' from '} the account balance.
                  </p>
                  <p className="text-sm font-medium mt-1">
                    New Balance: ₹{(
                      selectedAccount?.current_balance + 
                      (adjustmentData.type === 'add' ? 1 : -1) * (parseFloat(adjustmentData.amount) || 0)
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => {
                  setShowAdjustmentModal(false);
                  resetAdjustmentForm();
                }}
              >
                Cancel
              </button>
              <button
                className={`flex-1 px-4 py-2 rounded-md text-white ${
                  adjustmentData.type === 'add' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } ${(!adjustmentData.amount || !adjustmentData.reason) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Button clicked');
                  handleAdjustBalance();
                }}
                disabled={!adjustmentData.amount || loading}
              >
                {loading ? 'Processing...' : (adjustmentData.type === 'add' ? 'Add Money' : 'Reduce Money')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0}}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden relative" style={{zIndex: 9999, backgroundColor: 'white'}}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Transaction History - {selectedAccount?.account_name}</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Account Type</p>
                  <p className="font-medium capitalize">{selectedAccount?.account_type} Account</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Balance</p>
                  <p className="font-bold text-lg text-green-600">₹{selectedAccount?.current_balance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="overflow-auto max-h-96">
              {accountHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">📊 No transaction history available</p>
                  <p className="text-sm">Add money or make transactions to see history here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountHistory.map((transaction, index) => (
                    <div key={transaction.transaction_id || index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                            transaction.transaction_type === 'credit' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {transaction.transaction_type === 'credit' ? '+' : '-'}
                          </div>
                          <div>
                            <p className="font-medium">
                              {transaction.transaction_type === 'credit' ? 'Money Added' : 'Money Deducted'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(transaction.transaction_date).toLocaleDateString()} • {new Date(transaction.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.transaction_type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-gray-600">{transaction.description || 'No description'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-500">Balance: ₹{transaction.balance_before.toLocaleString()} → ₹{transaction.balance_after.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankCash;