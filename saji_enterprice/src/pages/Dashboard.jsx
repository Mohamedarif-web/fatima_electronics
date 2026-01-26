import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/table'
import { Package, DollarSign, ShoppingBag, AlertTriangle, Wallet, CreditCard, Users, TrendingUp, Plus, FileText } from 'lucide-react'
import db from '../utils/database'
import GSTInvoice from '../components/GSTInvoice'

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    todaySales: 0,
    todayPurchases: 0,
    cashBalance: 0,
    bankBalance: 0,
    receivables: 0,
    payables: 0,
    lowStockItems: []
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh dashboard data every 30 seconds to reflect real-time changes
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard data...');
      loadDashboardData();
    }, 30000); // 30 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get current month data
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endOfMonth = new Date(currentYear, currentMonth, 0).getDate();
      const endOfMonthDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endOfMonth).padStart(2, '0')}`;

      const [
        monthlySalesResponse,
        monthlyPurchaseResponse,
        partyOutstandingResponse,
        supplierOutstandingResponse,
        lowStockResponse
      ] = await Promise.all([
        // Monthly sales amount
        db.query(`
          SELECT COALESCE(SUM(total_amount), 0) as monthly_sales 
          FROM sales_invoices 
          WHERE invoice_date >= ? AND invoice_date <= ? 
            AND is_cancelled = 0 AND is_deleted = 0
        `, [startOfMonth, endOfMonthDate]),

        // Monthly purchase amount
        db.query(`
          SELECT COALESCE(SUM(total_amount), 0) as monthly_purchase 
          FROM purchase_invoices 
          WHERE bill_date >= ? AND bill_date <= ?
            AND is_cancelled = 0 AND is_deleted = 0
        `, [startOfMonth, endOfMonthDate]),

        // Total party outstanding (real-time calculation)
        db.query(`
          SELECT 
            COALESCE(SUM(
              p.opening_balance + 
              COALESCE(sales.total_outstanding_sales, 0) - 
              COALESCE(payments_in.total_payments_received, 0) +
              COALESCE(purchases.total_outstanding_purchases, 0) -
              COALESCE(payments_out.total_payments_made, 0)
            ), 0) as party_outstanding
          FROM parties p
          LEFT JOIN (
            SELECT 
              party_id, 
              SUM(balance_amount) as total_outstanding_sales
            FROM sales_invoices 
            WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
            GROUP BY party_id
          ) sales ON p.party_id = sales.party_id
          LEFT JOIN (
            SELECT 
              party_id,
              SUM(amount) as total_payments_received
            FROM payments
            WHERE payment_type = 'payment_in' AND is_deleted = 0
            GROUP BY party_id
          ) payments_in ON p.party_id = payments_in.party_id
          LEFT JOIN (
            SELECT 
              supplier_id as party_id,
              SUM(balance_amount) as total_outstanding_purchases
            FROM purchase_invoices
            WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
            GROUP BY supplier_id
          ) purchases ON p.party_id = purchases.party_id
          LEFT JOIN (
            SELECT 
              party_id,
              SUM(amount) as total_payments_made
            FROM payments
            WHERE payment_type = 'payment_out' AND is_deleted = 0
            GROUP BY party_id
          ) payments_out ON p.party_id = payments_out.party_id
          WHERE p.is_deleted = 0
        `),

        // Total supplier outstanding (real-time calculation)
        db.query(`
          SELECT 
            COALESCE(SUM(
              s.opening_balance + 
              COALESCE(purchases.total_outstanding_purchases, 0) - 
              COALESCE(payments_out.total_payments_made, 0)
            ), 0) as supplier_outstanding
          FROM suppliers s
          LEFT JOIN (
            SELECT 
              supplier_id, 
              SUM(balance_amount) as total_outstanding_purchases
            FROM purchase_invoices 
            WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
            GROUP BY supplier_id
          ) purchases ON s.supplier_id = purchases.supplier_id
          LEFT JOIN (
            SELECT 
              party_id as supplier_id,
              SUM(amount) as total_payments_made
            FROM payments
            WHERE payment_type = 'payment_out' AND is_deleted = 0
            GROUP BY party_id
          ) payments_out ON s.supplier_id = payments_out.supplier_id
          WHERE s.is_deleted = 0
        `),

        // Low stock items - force fresh data from database
        db.query(`
          SELECT product_name, current_stock, min_stock
          FROM items 
          WHERE current_stock <= min_stock AND min_stock > 0 AND is_deleted = 0
          ORDER BY current_stock ASC
        `)
      ]);

      const monthlySalesData = monthlySalesResponse[0];
      const monthlyPurchaseData = monthlyPurchaseResponse[0];
      const partyOutstandingData = partyOutstandingResponse[0];
      const supplierOutstandingData = supplierOutstandingResponse[0];

      setDashboardData({
        monthlySales: monthlySalesData?.monthly_sales || 0,
        monthlyPurchase: monthlyPurchaseData?.monthly_purchase || 0,
        partyOutstanding: partyOutstandingData?.party_outstanding || 0,
        supplierOutstanding: supplierOutstandingData?.supplier_outstanding || 0,
        lowStockItems: lowStockResponse || []
      });

      await loadRecentTransactions();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      console.log('🔄 Loading recent transactions...');
      
      // Use the same proven approach as All Transactions Report
      const transactions = await db.query(`
        SELECT 
          'Sale' as type,
          invoice_number as reference,
          invoice_date as date,
          total_amount as amount,
          'Credit' as flow,
          balance_amount as balance
        FROM sales_invoices 
        WHERE is_deleted = 0 
        
        UNION ALL
        
        SELECT 
          'Purchase' as type,
          bill_number as reference,
          bill_date as date,
          total_amount as amount,
          'Debit' as flow,
          balance_amount as balance
        FROM purchase_invoices 
        WHERE is_deleted = 0 
        
        UNION ALL
        
        SELECT 
          'Payment' as type,
          'PAY' || payment_id as reference,
          payment_date as date,
          amount as amount,
          CASE 
            WHEN payment_type = 'payment_in' THEN 'Credit'
            WHEN payment_type = 'payment_out' THEN 'Debit'
            ELSE 'Debit'
          END as flow,
          0 as balance
        FROM payments 
        WHERE is_deleted = 0 
        
        ORDER BY date DESC, reference DESC
        LIMIT 10
      `);

      console.log('✅ All transactions loaded:', transactions.length, transactions);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      setRecentTransactions([]);
    }
  };

  // Handle invoice generation for sales transactions
  const handleGenerateInvoice = (transaction) => {
    console.log('🧾 Generating invoice for transaction:', transaction);
    
    // Convert transaction data to invoice format
    const invoiceData = {
      invoiceNumber: transaction.reference || `INV-${Date.now()}`,
      invoiceDate: transaction.date || new Date().toISOString().split('T')[0],
      customer: {
        name: transaction.party_name || 'Walk-in Customer',
        address: 'Customer Address',
        phone: '',
        email: '',
        gstNumber: '',
        stateCode: '33' // Tamil Nadu
      },
      items: [{
        sno: 1,
        itemName: transaction.description || 'Sales Item',
        hsnCode: '00000',
        quantity: 1,
        unit: 'Nos',
        pricePerUnit: parseFloat(transaction.amount || 0),
        amount: parseFloat(transaction.amount || 0)
      }]
    };

    setSelectedTransaction(invoiceData);
    setShowInvoice(true);
  };

  const outstandingStats = [
    { 
      label: 'Monthly Sales', 
      value: `₹${dashboardData.monthlySales?.toLocaleString() || '0'}`, 
      icon: TrendingUp,
      color: 'text-green-600',
      description: 'Sales this month'
    },
    { 
      label: 'Monthly Purchase', 
      value: `₹${dashboardData.monthlyPurchase?.toLocaleString() || '0'}`, 
      icon: ShoppingBag,
      color: 'text-blue-600',
      description: 'Purchases this month'
    },
    { 
      label: 'Total Supplier Outstanding', 
      value: `₹${dashboardData.supplierOutstanding?.toLocaleString() || '0'}`, 
      icon: Wallet,
      color: 'text-orange-600',
      description: 'Amount we owe to suppliers'
    },
    { 
      label: 'Total Party Outstanding', 
      value: `₹${dashboardData.partyOutstanding?.toLocaleString() || '0'}`, 
      icon: CreditCard,
      color: 'text-red-600',
      description: 'Amount customers owe us'
    },
  ]

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <div className="text-lg">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outstanding Amount Cards - First */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {outstandingStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* All Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions</CardTitle>
            {/* Quick Action Buttons - Right Side */}
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  console.log('🔄 Manual refresh triggered');
                  loadDashboardData();
                }}
                className="flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                title="Refresh Dashboard Data"
              >
                <TrendingUp size={16} />
                Refresh
              </button>
              <button 
                onClick={() => window.location.hash = '#/sales/bill'}
                className="flex items-center gap-1 bg-fatima-green hover:bg-fatima-green/90 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Add Sale
              </button>
              <button 
                onClick={() => {
                  // Navigate to sales list page and trigger return modal
                  window.location.hash = '#/sales/list';
                  // Small delay to ensure page loads before triggering modal
                  setTimeout(() => {
                    // Trigger the return modal if the page has the function available
                    if (window.triggerReturnModal) {
                      window.triggerReturnModal();
                    }
                  }, 100);
                }}
                className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Add Return
              </button>
              <button 
                onClick={() => window.location.hash = '#/purchase/bill'}
                className="flex items-center gap-1 bg-fatima-green hover:bg-fatima-green/90 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Add Purchase
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Reference</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                  <TableHead className="text-center">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell className="whitespace-nowrap text-center">
                        {new Date(transaction.date).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          transaction.type === 'Sale'
                            ? 'bg-green-100 text-green-800' 
                            : transaction.type === 'Purchase'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-center">{transaction.reference}</TableCell>
                      <TableCell className="text-center font-medium">
                        ₹{parseFloat(transaction.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {transaction.balance > 0 ? (
                          <span className="text-red-600">₹{parseFloat(transaction.balance).toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600">Paid</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          transaction.balance > 0 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {transaction.balance > 0 ? 'Pending' : 'Completed'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {transaction.type === 'Sale' ? (
                          <button
                            onClick={() => handleGenerateInvoice(transaction)}
                            className="inline-flex items-center gap-1 bg-fatima-green hover:bg-fatima-green/90 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Generate Invoice"
                          >
                            <FileText size={12} />
                            Invoice
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No recent transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {dashboardData.lowStockItems.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-red-700">Low Stock Alert</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.lowStockItems.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 px-3 bg-red-50 border-l-4 border-l-red-500 rounded-r-md mb-2">
                  <span className="font-bold text-red-700 text-base">
                    🔴 {item.product_name}
                  </span>
                  <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded font-medium">
                    Stock: {item.current_stock} / Min: {item.min_stock}
                  </span>
                </div>
              ))}
              {dashboardData.lowStockItems.length > 5 && (
                <div className="text-sm text-muted-foreground mt-2">
                  +{dashboardData.lowStockItems.length - 5} more items need attention
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Modal */}
      {showInvoice && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <GSTInvoice 
              invoiceData={selectedTransaction}
              onSave={() => {
                setShowInvoice(false);
                setSelectedTransaction(null);
              }}
              onCancel={() => {
                setShowInvoice(false);
                setSelectedTransaction(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
