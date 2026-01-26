import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Minus, Eye, Edit, Trash2, CreditCard, Building2, Wallet } from 'lucide-react';
import db from '../../utils/database';

const BankManagement = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'add', // 'add' or 'reduce'
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await db.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedAccount || !adjustmentData.amount || !adjustmentData.reason) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      const amount = parseFloat(adjustmentData.amount);
      const finalAmount = adjustmentData.type === 'add' ? amount : -amount;

      // Update account balance with transaction history
      await db.updateAccountBalance(
        selectedAccount.account_id,
        finalAmount,
        {
          reference_type: 'manual_adjustment',
          reference_id: null,
          transaction_date: adjustmentData.date,
          description: `Manual ${adjustmentData.type === 'add' ? 'deposit' : 'withdrawal'}: ${adjustmentData.reason}`
        }
      );

      // Record in payment transactions for complete audit trail
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

      alert(`₹${amount.toLocaleString()} ${adjustmentData.type === 'add' ? 'added to' : 'deducted from'} ${selectedAccount.account_name} successfully!`);
      
      setShowAdjustmentModal(false);
      resetAdjustmentForm();
      loadAccounts(); // Refresh balances
      
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

  const getAccountIcon = (accountType) => {
    switch (accountType) {
      case 'cash': return <Wallet className="w-6 h-6 text-green-600" />;
      case 'bank': return <Building2 className="w-6 h-6 text-fatima-green" />;
      case 'card': return <CreditCard className="w-6 h-6 text-purple-600" />;
      default: return <Building2 className="w-6 h-6 text-gray-600" />;
    }
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage bank accounts and balances
          </p>
        </div>
        <Button onClick={() => window.location.href = '/bank'}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Bank Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No bank accounts found. Create your first account to get started.
          </div>
        ) : (
          accounts.map((account) => (
            <Card key={account.account_id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getAccountIcon(account.account_type)}
                    <div>
                      <CardTitle className="text-lg">{account.account_name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">
                        {account.account_type} Account
                        {account.is_default === 1 && (
                          <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-blue-800">
                            Default
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Account Details */}
                <div className="space-y-2">
                  {account.account_type === 'bank' && (
                    <>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Bank:</span>
                        <span className="ml-2 font-medium">{account.bank_name || '-'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">A/C:</span>
                        <span className="ml-2 font-mono">{account.account_number || '-'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">IFSC:</span>
                        <span className="ml-2 font-mono">{account.ifsc_code || '-'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Balance Display */}
                <div className="border-t pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Balance</p>
                    <p className={`text-2xl font-bold ${getBalanceColor(account.current_balance)}`}>
                      {account.current_balance < 0 ? '-' : ''}{formatCurrency(account.current_balance)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => openAdjustmentModal(account, 'add')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Money
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                    onClick={() => openAdjustmentModal(account, 'reduce')}
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    Reduce
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => console.log('View transactions for account:', account.account_id)}
                    title="View Transactions"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Balance Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">
              {adjustmentData.type === 'add' ? 'Add Money' : 'Reduce Money'} - {selectedAccount?.account_name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
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
                <label className="block text-sm font-medium mb-1">Reason *</label>
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

              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  This will {adjustmentData.type === 'add' ? 'add ₹' : 'reduce ₹'}{adjustmentData.amount || '0'} 
                  {adjustmentData.type === 'add' ? ' to ' : ' from '} the account balance.
                </p>
                {adjustmentData.amount && (
                  <p className="text-sm font-medium mt-1">
                    New Balance: ₹{(
                      selectedAccount?.current_balance + 
                      (adjustmentData.type === 'add' ? 1 : -1) * (parseFloat(adjustmentData.amount) || 0)
                    ).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAdjustmentModal(false);
                  resetAdjustmentForm();
                }}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${adjustmentData.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                onClick={handleAdjustBalance}
                disabled={!adjustmentData.amount || !adjustmentData.reason}
              >
                {adjustmentData.type === 'add' ? 'Add Money' : 'Reduce Money'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankManagement;