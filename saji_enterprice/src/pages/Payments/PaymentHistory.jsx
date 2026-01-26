import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Search, Filter, Download, Eye } from 'lucide-react';
import db from '../../utils/database';

const PaymentHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    account_id: '',
    reference_type: '',
    date_from: '',
    date_to: '',
    search_term: ''
  });

  useEffect(() => {
    loadAccounts();
    loadPaymentHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  const loadAccounts = async () => {
    try {
      const data = await db.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      const data = await db.getPaymentHistory();
      console.log('Payment history loaded:', data);
      setTransactions(data);
    } catch (error) {
      console.error('Error loading payment history:', error);
      // Fallback: show empty state if tables don't exist yet
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = transactions;

    // Apply filters
    if (filters.account_id) {
      filtered = filtered.filter(t => t.account_id == filters.account_id);
    }

    if (filters.reference_type) {
      filtered = filtered.filter(t => t.reference_type === filters.reference_type);
    }

    if (filters.date_from) {
      filtered = filtered.filter(t => t.payment_date >= filters.date_from);
    }

    if (filters.date_to) {
      filtered = filtered.filter(t => t.payment_date <= filters.date_to);
    }

    if (filters.search_term) {
      const searchLower = filters.search_term.toLowerCase();
      filtered = filtered.filter(t =>
        t.party_name?.toLowerCase().includes(searchLower) ||
        t.reference_number?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTransactions(filtered);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      account_id: '',
      reference_type: '',
      date_from: '',
      date_to: '',
      search_term: ''
    });
  };

  const formatAmount = (amount, paymentType) => {
    const formatted = `₹${Math.abs(amount).toLocaleString()}`;
    return paymentType === 'payment_in' ? 
      <span className="text-green-600 font-medium">+{formatted}</span> :
      <span className="text-red-600 font-medium">-{formatted}</span>;
  };

  const getTransactionTypeIcon = (referenceType) => {
    switch (referenceType) {
      case 'sales_invoice': return '🛒';
      case 'purchase_invoice': return '🛍️';
      case 'expense': return '💸';
      default: return '💰';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete transaction history across Sales, Purchases & Expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearFilters}>
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Party, Invoice, Description..."
                  value={filters.search_term}
                  onChange={(e) => handleFilterChange('search_term', e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-md w-full border border-input"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Bank Account</label>
              <select
                value={filters.account_id}
                onChange={(e) => handleFilterChange('account_id', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              >
                <option value="">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Transaction Type</label>
              <select
                value={filters.reference_type}
                onChange={(e) => handleFilterChange('reference_type', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              >
                <option value="">All Types</option>
                <option value="sales_invoice">Sales</option>
                <option value="purchase_invoice">Purchase</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              />
            </div>
          </div>
          
          {filteredTransactions.length !== transactions.length && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto overflow-y-hidden border rounded-lg">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">S.No</TableHead>
                  <TableHead className="min-w-[100px]">Date</TableHead>
                  <TableHead className="min-w-[80px]">Type</TableHead>
                  <TableHead className="min-w-[120px]">Reference</TableHead>
                  <TableHead className="min-w-[150px]">Party</TableHead>
                  <TableHead className="min-w-[150px]">Bank Account</TableHead>
                  <TableHead className="min-w-[100px] text-right">Amount</TableHead>
                  <TableHead className="min-w-[80px]">Method</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="min-w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading payment history...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {transactions.length === 0 ? 
                        'No payment transactions found. Start by creating invoices with payments.' :
                        'No transactions match your filters.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction, index) => (
                    <TableRow key={transaction.payment_id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{new Date(transaction.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getTransactionTypeIcon(transaction.reference_type)}</span>
                          <span className="capitalize">{transaction.transaction_category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{transaction.reference_number}</TableCell>
                      <TableCell>{transaction.party_name || '-'}</TableCell>
                      <TableCell>{transaction.account_name}</TableCell>
                      <TableCell className="text-right">
                        {formatAmount(transaction.amount, transaction.payment_type)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {transaction.payment_method?.replace('_', ' ') || 'Bank Transfer'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={transaction.description}>
                        {transaction.description}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log('View details:', transaction)}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;