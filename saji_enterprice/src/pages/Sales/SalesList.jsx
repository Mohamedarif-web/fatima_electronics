import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Eye, Edit, Trash2, FileText, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import db from '../../utils/database';

const SalesList = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });
  
  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnInvoices, setReturnInvoices] = useState([]);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState('');

  useEffect(() => {
    loadInvoices();
    
    // Set up global function for dashboard to trigger return modal
    window.triggerReturnModal = () => {
      setShowReturnModal(true);
      loadReturnInvoices();
    };
    
    // Cleanup function on component unmount
    return () => {
      delete window.triggerReturnModal;
    };
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      
      // Calculate returns from sales_invoice_items table and get product info
      console.log('Loading invoices with returns data and products...');
      const data = await db.query(`
        SELECT
          si.*,
          p.name as customer_name,
          p.phone as customer_phone,
          COALESCE(
            (SELECT COUNT(*) 
             FROM sales_invoice_items sii 
             WHERE sii.invoice_id = si.invoice_id 
             AND sii.return_quantity > 0), 0
          ) as total_returns,
          COALESCE(
            (SELECT GROUP_CONCAT(i.product_name || ' (' || (sii.quantity - COALESCE(sii.return_quantity, 0)) || ')', ', ')
             FROM sales_invoice_items sii 
             JOIN items i ON sii.item_id = i.item_id
             WHERE sii.invoice_id = si.invoice_id
             AND (sii.quantity - COALESCE(sii.return_quantity, 0)) > 0
             LIMIT 3), 'No items'
          ) as products_summary
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.is_deleted = 0
        ORDER BY si.invoice_date DESC, si.invoice_id DESC
      `);
      
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({ ...prev, [field]: value }));
  };

  const applyDateFilter = async () => {
    if (!dateFilter.from || !dateFilter.to) {
      loadInvoices();
      return;
    }

    try {
      setLoading(true);
      // Calculate returns from sales_invoice_items table for filtered results and get product info
      console.log('Loading filtered invoices with returns data and products...');
      const data = await db.query(`
        SELECT
          si.*,
          p.name as customer_name,
          p.phone as customer_phone,
          COALESCE(
            (SELECT COUNT(*) 
             FROM sales_invoice_items sii 
             WHERE sii.invoice_id = si.invoice_id 
             AND sii.return_quantity > 0), 0
          ) as total_returns,
          COALESCE(
            (SELECT GROUP_CONCAT(i.product_name || ' (' || (sii.quantity - COALESCE(sii.return_quantity, 0)) || ')', ', ')
             FROM sales_invoice_items sii 
             JOIN items i ON sii.item_id = i.item_id
             WHERE sii.invoice_id = si.invoice_id
             AND (sii.quantity - COALESCE(sii.return_quantity, 0)) > 0
             LIMIT 3), 'No items'
          ) as products_summary
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.is_deleted = 0
        AND DATE(si.invoice_date) >= DATE(?)
        AND DATE(si.invoice_date) <= DATE(?)
        ORDER BY si.invoice_date DESC, si.invoice_id DESC
      `, [dateFilter.from, dateFilter.to]);
      setInvoices(data);
    } catch (error) {
      console.error('Error filtering invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewInvoice = async (invoiceId) => {
    try {
      // Get invoice details with items
      const invoice = await db.get(`
        SELECT
          si.*,
          p.name as customer_name,
          p.address as customer_address,
          p.phone as customer_phone,
          p.gst_number as customer_gst
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.invoice_id = ?
      `, [invoiceId]);

      const items = await db.query(`
        SELECT
          sii.*,
          i.product_name,
          i.unit
        FROM sales_invoice_items sii
        LEFT JOIN items i ON sii.item_id = i.item_id
        WHERE sii.invoice_id = ?
      `, [invoiceId]);

      // Show invoice details in a modal or new component
      showInvoiceDetails(invoice, items);
    } catch (error) {
      console.error('Error viewing invoice:', error);
    }
  };

  const editInvoice = (invoiceId) => {
    navigate(`/sales/invoice?edit=${invoiceId}`);
  };

  const showInvoiceDetails = (invoice, items) => {
    // Create a simple modal/popup to show invoice details
    const detailsHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e1b4b; margin: 0;">FATHIMA ELECTRICALS</h1>
          <h2 style="color: #80675d; margin: 5px 0;">SALES INVOICE</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <h3>Bill To:</h3>
            <p><strong>${invoice.customer_name}</strong></p>
            <p>${invoice.customer_address || ''}</p>
            <p>Phone: ${invoice.customer_phone || ''}</p>
            <p>GST: ${invoice.customer_gst || ''}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
            <p><strong>Payment Type:</strong> ${invoice.payment_type.toUpperCase()}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rate</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Disc</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Tax</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity} ${item.unit}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.rate.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.discount_amount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.tax_amount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.total_amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 20px;">
          <p><strong>Subtotal: ₹${invoice.subtotal.toFixed(2)}</strong></p>
          <p><strong>Discount: -₹${invoice.discount_amount.toFixed(2)}</strong></p>
          <p><strong>Tax: ₹${invoice.tax_amount.toFixed(2)}</strong></p>
          <h3 style="color: #1e1b4b;">Total: ₹${invoice.total_amount.toFixed(2)}</h3>
        </div>

        ${invoice.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
      </div>
    `;

    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
        </head>
        <body>
          ${detailsHtml}
          <div style="text-align: center; margin: 30px; print:hidden;">
            <button onclick="window.print()" style="background: #1e1b4b; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Print</button>
            <button onclick="window.close()" style="background: #80675d; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Close</button>
          </div>
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  const updatePaymentStatus = async (invoiceId, newStatus) => {
    try {
      const invoice = invoices.find(inv => inv.invoice_id === invoiceId);
      if (!invoice) {
        alert('Invoice not found');
        return;
      }

      let paid_amount, balance_amount;
      
      switch (newStatus) {
        case 'paid':
          paid_amount = invoice.total_amount;
          balance_amount = 0;
          break;
        case 'not_paid':
          paid_amount = 0;
          balance_amount = invoice.total_amount;
          break;
        case 'pending':
          // Set to partially paid (50% for example, or keep existing if already partial)
          if (invoice.paid_amount > 0 && invoice.paid_amount < invoice.total_amount) {
            paid_amount = invoice.paid_amount;
            balance_amount = invoice.balance_amount;
          } else {
            paid_amount = invoice.total_amount / 2;
            balance_amount = invoice.total_amount / 2;
          }
          break;
        default:
          return;
      }

      // Update the database
      await db.run(`
        UPDATE sales_invoices 
        SET paid_amount = ?, balance_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE invoice_id = ?
      `, [paid_amount, balance_amount, invoiceId]);

      // Update customer balance if it's a credit sale
      if (invoice.payment_type === 'credit') {
        const balanceDifference = balance_amount - invoice.balance_amount;
        await db.run(`
          UPDATE parties 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE party_id = ?
        `, [balanceDifference, invoice.party_id]);
      }

      // Update only the specific invoice in state instead of reloading all
      setInvoices(prevInvoices => 
        prevInvoices.map(inv => 
          inv.invoice_id === invoiceId 
            ? { ...inv, paid_amount, balance_amount }
            : inv
        )
      );
      
      console.log(`✅ Payment status updated for invoice ${invoice.invoice_number} to ${newStatus}`);
    } catch (error) {
      console.error('❌ Error updating payment status:', error);
      alert('Error updating payment status: ' + error.message);
    }
  };

  const getPaymentStatusValue = (invoice) => {
    if (invoice.is_cancelled) return 'cancelled';
    if (invoice.balance_amount === 0) return 'paid';
    if (invoice.paid_amount === 0) return 'not_paid';
    return 'pending';
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'not_paid': return 'Not Paid';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (window.confirm('Are you sure you want to delete this invoice? This will reverse all transactions and restore stock. This action cannot be undone.')) {
      try {
        console.log('🗑️ Starting invoice deletion process for ID:', invoiceId);
        
        // Get invoice details before deletion
        const invoice = await db.get(`
          SELECT si.*, p.name as customer_name
          FROM sales_invoices si
          LEFT JOIN parties p ON si.party_id = p.party_id  
          WHERE si.invoice_id = ?
        `, [invoiceId]);
        
        if (!invoice) {
          alert('Invoice not found');
          return;
        }
        
        console.log('📄 Invoice to delete:', invoice);
        
        // Get invoice items to restore stock
        const invoiceItems = await db.query(`
          SELECT sii.*, i.product_name
          FROM sales_invoice_items sii
          LEFT JOIN items i ON sii.item_id = i.item_id
          WHERE sii.invoice_id = ?
        `, [invoiceId]);
        
        console.log('📦 Items to restore:', invoiceItems);
        
        // 1. Restore stock for all items
        for (const item of invoiceItems) {
          // 🔥 FIX: Only restore the actual sold quantity (quantity - returns)
          const returnQuantity = item.return_quantity || 0;
          const actualSoldQuantity = item.quantity - returnQuantity;
          
          if (actualSoldQuantity > 0) {
            await db.run(`
              UPDATE items 
              SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
              WHERE item_id = ?
            `, [actualSoldQuantity, item.item_id]);
            
            console.log(`✅ Restored ${actualSoldQuantity} units of ${item.product_name} (sold: ${item.quantity}, returned: ${returnQuantity})`);
          } else {
            console.log(`ℹ️ No stock to restore for ${item.product_name} - all units were returned`);
          }
        }
        
        // 2. Reverse customer balance (for credit sales)
        if (invoice.payment_type === 'credit' && invoice.total_amount > 0) {
          await db.run(`
            UPDATE parties 
            SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE party_id = ?
          `, [invoice.total_amount, invoice.party_id]);
          
          console.log(`💰 Reversed customer balance: -₹${invoice.total_amount}`);
        }
        
        // 3. Reverse bank/cash account balance (for cash sales)
        if (invoice.payment_type === 'cash' && invoice.account_id && invoice.total_amount > 0) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [invoice.total_amount, invoice.account_id]);
          
          console.log(`🏦 Reversed account balance: -₹${invoice.total_amount}`);
        }
        
        // 4. Reverse payment transactions
        try {
          // Get all payment transactions for this invoice
          const paymentTransactions = await db.query(`
            SELECT * FROM payment_transactions 
            WHERE reference_type = 'sales_invoice' AND reference_id = ? AND is_deleted = 0
          `, [invoiceId]);
          
          console.log('💳 Payment transactions to reverse:', paymentTransactions);
          
          for (const payment of paymentTransactions) {
            // Reverse the account balance
            await db.run(`
              UPDATE accounts 
              SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
              WHERE account_id = ?
            `, [payment.amount, payment.account_id]);
            
            // Mark payment transaction as deleted
            await db.run(`
              UPDATE payment_transactions 
              SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
              WHERE payment_id = ?
            `, [payment.payment_id]);
            
            // Record reversal transaction in account_transactions
            await db.run(`
              INSERT INTO account_transactions (
                account_id, transaction_type, amount, balance_before, balance_after,
                transaction_date, description, reference_type, reference_id
              ) VALUES (?, 'debit', ?, 
                (SELECT current_balance + ? FROM accounts WHERE account_id = ?),
                (SELECT current_balance FROM accounts WHERE account_id = ?),
                ?, ?, 'sales_invoice_delete', ?)
            `, [
              payment.account_id, payment.amount,
              payment.amount, payment.account_id, payment.account_id,
              new Date().toISOString().split('T')[0],
              `Payment reversal for deleted invoice ${invoice.invoice_number}`,
              invoiceId
            ]);
            
            console.log(`🔄 Reversed payment: ₹${payment.amount} from account ${payment.account_id}`);
          }
        } catch (paymentError) {
          console.log('ℹ️ No payment transactions to reverse or payment tables not found');
        }
        
        // 5. Mark invoice as deleted
        await db.run(`
          UPDATE sales_invoices 
          SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP 
          WHERE invoice_id = ?
        `, [invoiceId]);
        
        console.log('✅ Invoice marked as deleted');
        
        // 6. Reload invoices list
        await loadInvoices();
        
        alert(`Invoice ${invoice.invoice_number} deleted successfully!\n\n` +
              `✅ Stock restored for ${invoiceItems.length} items\n` +
              `✅ Customer balance updated\n` +
              `✅ Bank transactions reversed\n` +
              `✅ Payment history updated`);
              
      } catch (error) {
        console.error('❌ Error deleting invoice:', error);
        alert('Error deleting invoice: ' + error.message);
      }
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    // Text search filter
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || getPaymentStatusValue(invoice) === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getTotalStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = filteredInvoices.filter(inv => inv.invoice_date === today);
    const todayTotal = todayInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    
    return {
      totalInvoices: filteredInvoices.length,
      todayInvoices: todayInvoices.length,
      todayTotal,
      totalAmount
    };
  };

  const stats = getTotalStats();

  // Load invoices available for returns
  const loadReturnInvoices = async () => {
    try {
      const data = await db.query(`
        SELECT 
          si.invoice_id,
          si.invoice_number,
          si.invoice_date,
          si.total_amount,
          COALESCE(p.name, 'Cash Customer') as customer_name,
          COUNT(sii.item_id) as total_items,
          SUM(CASE WHEN sii.quantity > COALESCE(sii.return_quantity, 0) THEN 1 ELSE 0 END) as returnable_items
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        LEFT JOIN sales_invoice_items sii ON si.invoice_id = sii.invoice_id
        WHERE si.is_deleted = 0 
        AND si.invoice_date >= DATE('now', '-90 days')
        GROUP BY si.invoice_id
        HAVING returnable_items > 0
        ORDER BY si.invoice_date DESC
      `);
      setReturnInvoices(data);
    } catch (error) {
      console.error('Error loading return invoices:', error);
    }
  };

  // Handle return invoice selection
  const handleReturnSelection = () => {
    if (!selectedReturnInvoice) {
      alert('Please select an invoice for return');
      return;
    }
    setShowReturnModal(false);
    navigate(`/sales/invoice?return=${selectedReturnInvoice}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Sales Invoices</h1>
        <div className="flex gap-3">
          <Button 
            onClick={() => {
              setShowReturnModal(true);
              loadReturnInvoices();
            }} 
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Return
          </Button>
          <Button 
            onClick={() => navigate('/sales/invoice')} 
            className="bg-fatima-green hover:bg-fatima-green/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">{stats.totalInvoices}</div>
              <div className="text-sm text-muted-foreground">Total Invoices</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.todayInvoices}</div>
              <div className="text-sm text-muted-foreground">Today's Invoices</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">₹{stats.todayTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Today's Sales</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">₹{stats.totalAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Sales</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md"
              />
            </div>
            <div className="flex gap-2">
              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium min-w-[120px]"
                style={{
                  backgroundColor: statusFilter === 'all' 
                    ? '#ffffff' 
                    : statusFilter === 'paid'
                    ? '#dcfce7'
                    : statusFilter === 'pending'
                    ? '#fef3c7'
                    : statusFilter === 'not_paid'
                    ? '#fee2e2'
                    : '#f3f4f6',
                  color: statusFilter === 'all' 
                    ? '#374151' 
                    : statusFilter === 'paid'
                    ? '#166534'
                    : statusFilter === 'pending'
                    ? '#92400e'
                    : statusFilter === 'not_paid'
                    ? '#991b1b'
                    : '#374151'
                }}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="not_paid">Not Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
                <input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => handleDateFilterChange('from', e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  placeholder="From Date"
                  className="pl-10 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:border-fatima-green focus:ring-2 focus:ring-green-200 text-gray-900 cursor-pointer"
                  style={{
                    backgroundColor: '#ffffff',
                    minWidth: '150px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
                <input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => handleDateFilterChange('to', e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  placeholder="To Date"
                  className="pl-10 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:border-fatima-green focus:ring-2 focus:ring-green-200 text-gray-900 cursor-pointer"
                  style={{
                    backgroundColor: '#ffffff',
                    minWidth: '150px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <Button 
                onClick={applyDateFilter} 
                className="bg-fatima-green hover:bg-fatima-green/90 text-white"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button 
                onClick={() => {
                  setDateFilter({ from: '', to: '' });
                  loadInvoices();
                }}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading invoices...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Returns</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice, index) => (
                    <TableRow key={invoice.invoice_id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{invoice.customer_name || '-'}</TableCell>
                      <TableCell>{invoice.customer_phone || '-'}</TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-xs text-gray-600 truncate" title={invoice.products_summary}>
                          {invoice.products_summary || 'No items'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          invoice.payment_type === 'cash' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-green-100 text-blue-800'
                        }`}>
                          {invoice.payment_type.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>₹{(invoice.subtotal || 0).toLocaleString()}</TableCell>
                      <TableCell>₹{(invoice.discount_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>₹{(invoice.tax_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">₹{invoice.total_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-center w-40 whitespace-nowrap">
                        {invoice.total_returns > 0 ? (
                          <span className="px-4 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium whitespace-nowrap">
                            {invoice.total_returns} Items</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No Returns</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <select
                          value={getPaymentStatusValue(invoice)}
                          onChange={(e) => updatePaymentStatus(invoice.invoice_id, e.target.value)}
                          disabled={invoice.is_cancelled}
                          className="px-2 py-1 rounded text-xs font-medium border cursor-pointer"
                          style={{
                            backgroundColor: invoice.is_cancelled 
                              ? '#f3f4f6' 
                              : invoice.balance_amount === 0
                              ? '#dcfce7'
                              : invoice.paid_amount === 0
                              ? '#fee2e2'
                              : '#fef3c7',
                            color: invoice.is_cancelled 
                              ? '#374151' 
                              : invoice.balance_amount === 0
                              ? '#166534'
                              : invoice.paid_amount === 0
                              ? '#991b1b'
                              : '#92400e',
                            borderColor: invoice.is_cancelled 
                              ? '#d1d5db' 
                              : invoice.balance_amount === 0
                              ? '#bbf7d0'
                              : invoice.paid_amount === 0
                              ? '#fecaca'
                              : '#fde68a'
                          }}
                        >
                          {!invoice.is_cancelled && (
                            <>
                              <option value="paid">Paid</option>
                              <option value="pending">Pending</option>
                              <option value="not_paid">Not Paid</option>
                            </>
                          )}
                          {invoice.is_cancelled && (
                            <option value="cancelled">Cancelled</option>
                          )}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editInvoice(invoice.invoice_id)}
                            className="p-2 rounded-md transition-colors bg-fatima-green hover:bg-fatima-green text-white flex items-center justify-center"
                            title="Edit Invoice"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => window.location.hash = `#/sales/gst-invoice?id=${invoice.invoice_id}`}
                            className="p-2 rounded-md transition-colors bg-fatima-green hover:bg-fatima-green text-white flex items-center justify-center"
                            title="GST Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice.invoice_id)}
                            className="p-2 rounded-md transition-colors flex items-center justify-center"
                            style={{backgroundColor: '#ef4444', color: 'white'}}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Select Invoice for Return</h2>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Invoice (Last 90 days with returnable items):
              </label>
              <select
                value={selectedReturnInvoice}
                onChange={(e) => setSelectedReturnInvoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">-- Select Invoice --</option>
                {returnInvoices.map((invoice) => (
                  <option key={invoice.invoice_id} value={invoice.invoice_id}>
                    {invoice.invoice_number} - {invoice.customer_name} - ₹{invoice.total_amount.toLocaleString()} 
                    ({new Date(invoice.invoice_date).toLocaleDateString()}) 
                    - {invoice.returnable_items} returnable items
                  </option>
                ))}
              </select>
              {returnInvoices.length === 0 && (
                <p className="text-gray-500 text-sm mt-2">No invoices available for returns in the last 90 days.</p>
              )}
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowReturnModal(false)}
                variant="outline"
                className="border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReturnSelection}
                disabled={!selectedReturnInvoice}
                className="bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-300"
              >
                Process Return
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesList;