import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Eye, Trash2, Calendar, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import db from '../../utils/database';

const PurchaseList = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          pi.*,
          s.name as supplier_name,
          s.phone as supplier_phone
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON pi.supplier_id = s.supplier_id
        WHERE pi.is_deleted = 0
        ORDER BY pi.bill_date DESC, pi.purchase_id DESC
      `);
      
      // Load purchased items for each invoice
      const purchasesWithItems = await Promise.all(
        data.map(async (purchase) => {
          const items = await db.query(`
            SELECT 
              pii.*,
              i.product_name
            FROM purchase_invoice_items pii
            LEFT JOIN items i ON pii.item_id = i.item_id
            WHERE pii.purchase_id = ?
            ORDER BY i.product_name
          `, [purchase.purchase_id]);
          
          return {
            ...purchase,
            items: items || []
          };
        })
      );
      
      setPurchases(purchasesWithItems);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({ ...prev, [field]: value }));
  };

  const applyDateFilter = async () => {
    if (!dateFilter.from || !dateFilter.to) {
      loadPurchases();
      return;
    }

    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          pi.*,
          s.name as supplier_name,
          s.phone as supplier_phone
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON pi.supplier_id = s.supplier_id
        WHERE pi.is_deleted = 0 
        AND DATE(pi.bill_date) >= DATE(?)
        AND DATE(pi.bill_date) <= DATE(?)
        ORDER BY pi.bill_date DESC, pi.purchase_id DESC
      `, [dateFilter.from, dateFilter.to]);
      setPurchases(data);
    } catch (error) {
      console.error('Error filtering purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewPurchase = async (purchaseId) => {
    try {
      // Get purchase details with items
      const purchase = await db.get(`
        SELECT 
          pi.*,
          s.name as supplier_name,
          s.address as supplier_address,
          s.phone as supplier_phone,
          '' as supplier_gst
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON pi.supplier_id = s.supplier_id
        WHERE pi.purchase_id = ?
      `, [purchaseId]);

      const items = await db.query(`
        SELECT 
          pii.*,
          i.product_name,
          i.unit
        FROM purchase_invoice_items pii
        LEFT JOIN items i ON pii.item_id = i.item_id
        WHERE pii.purchase_id = ?
      `, [purchaseId]);

      // Show purchase details
      showPurchaseDetails(purchase, items);
    } catch (error) {
      console.error('Error viewing purchase:', error);
    }
  };

  const showPurchaseDetails = (purchase, items) => {
    const detailsHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e1b4b; margin: 0;">FATHIMA ELECTRICALS</h1>
          <h2 style="color: #80675d; margin: 5px 0;">PURCHASE BILL</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <h3>Supplier:</h3>
            <p><strong>${purchase.supplier_name}</strong></p>
            <p>${purchase.supplier_address || ''}</p>
            <p>Phone: ${purchase.supplier_phone || ''}</p>
            <p>GST: ${purchase.supplier_gst || ''}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Bill No:</strong> ${purchase.bill_number}</p>
            <p><strong>Date:</strong> ${new Date(purchase.bill_date).toLocaleDateString()}</p>
            <p><strong>Payment Type:</strong> ${purchase.payment_type.toUpperCase()}</p>
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
          <p><strong>Subtotal: ₹${purchase.subtotal.toFixed(2)}</strong></p>
          <p><strong>Discount: -₹${purchase.discount_amount.toFixed(2)}</strong></p>
          <p><strong>Tax: ₹${purchase.tax_amount.toFixed(2)}</strong></p>
          <h3 style="color: #1e1b4b;">Total: ₹${purchase.total_amount.toFixed(2)}</h3>
        </div>

        ${purchase.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong> ${purchase.notes}</div>` : ''}
      </div>
    `;

    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
      <html>
        <head>
          <title>Purchase Bill ${purchase.bill_number}</title>
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

  const deletePurchase = async (purchaseId) => {
    if (window.confirm('Are you sure you want to delete this purchase bill? This action cannot be undone.')) {
      try {
        // First get the purchase details before deleting
        const purchase = await db.get('SELECT * FROM purchase_invoices WHERE purchase_id = ?', [purchaseId]);
        const purchaseItems = await db.query('SELECT * FROM purchase_invoice_items WHERE purchase_id = ?', [purchaseId]);
        
        if (!purchase) {
          alert('Purchase invoice not found!');
          return;
        }
        
        console.log('🗑️ Deleting purchase:', purchase.bill_number);
        console.log('💰 Reversing payment and stock changes...');
        
        // Reverse stock changes (subtract the purchased quantities)
        for (const item of purchaseItems) {
          await db.run(`
            UPDATE items 
            SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
            WHERE item_id = ?
          `, [item.quantity, item.item_id]);
          console.log(`📦 Stock reduced for item ${item.item_id}: -${item.quantity} units`);
        }
        
        // Return payment amount to bank account
        if (purchase.paid_amount > 0 && purchase.account_id) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [purchase.paid_amount, purchase.account_id]);
          console.log(`🏦 Returned payment: +₹${purchase.paid_amount} to account ${purchase.account_id}`);
        }
        
        // Remove supplier balance (subtract the outstanding amount)
        const supplierBalance = purchase.total_amount - (purchase.paid_amount || 0);
        if (supplierBalance > 0) {
          try {
            await db.run(`
              UPDATE suppliers 
              SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
              WHERE supplier_id = ?
            `, [supplierBalance, purchase.supplier_id]);
            console.log(`👤 Reduced supplier balance: -₹${supplierBalance} from supplier ${purchase.supplier_id}`);
          } catch (error) {
            // Fallback to parties table
            await db.run(`
              UPDATE parties 
              SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
              WHERE party_id = ?
            `, [supplierBalance, purchase.supplier_id]);
            console.log(`👤 Reduced party balance: -₹${supplierBalance} from party ${purchase.supplier_id}`);
          }
        }
        
        // Delete related payment transactions
        try {
          await db.run(`
            DELETE FROM payment_transactions 
            WHERE reference_type = 'purchase_invoice' AND reference_id = ?
          `, [purchaseId]);
          console.log('🗑️ Deleted payment transactions');
        } catch (error) {
          console.log('Payment transactions table not available or already deleted');
        }
        
        // Permanently delete purchase invoice and items
        await db.run('DELETE FROM purchase_invoice_items WHERE purchase_id = ?', [purchaseId]);
        await db.run('DELETE FROM purchase_invoices WHERE purchase_id = ?', [purchaseId]);
        
        alert(`Purchase bill ${purchase.bill_number} deleted successfully!\n• Returned ₹${purchase.paid_amount || 0} to bank account\n• Removed ₹${supplierBalance} from supplier balance\n• Stock quantities reversed`);
        await loadPurchases();
      } catch (error) {
        console.error('Error deleting purchase:', error);
        alert('Error deleting purchase bill: ' + error.message);
      }
    }
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTotalStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayPurchases = filteredPurchases.filter(purchase => purchase.bill_date === today);
    const todayTotal = todayPurchases.reduce((sum, purchase) => sum + purchase.total_amount, 0);
    const totalAmount = filteredPurchases.reduce((sum, purchase) => sum + purchase.total_amount, 0);
    
    return {
      totalPurchases: filteredPurchases.length,
      todayPurchases: todayPurchases.length,
      todayTotal,
      totalAmount
    };
  };

  const stats = getTotalStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Purchase Bills</h1>
        <Button 
          onClick={() => navigate('/purchase/bill')} 
          className="bg-fatima-green hover:bg-fatima-green/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Purchase Bill
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">{stats.totalPurchases}</div>
              <div className="text-sm text-muted-foreground">Total Bills</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.todayPurchases}</div>
              <div className="text-sm text-muted-foreground">Today's Bills</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">₹{stats.todayTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Today's Purchases</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">₹{stats.totalAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Purchases</div>
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
                placeholder="Search purchase bills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
                <input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => handleDateFilterChange('from', e.target.value)}
                  className="pl-10 pr-4 py-2 border border-input rounded-md cursor-pointer"
                  style={{
                    colorScheme: 'light',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
                <input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => handleDateFilterChange('to', e.target.value)}
                  className="pl-10 pr-4 py-2 border border-input rounded-md cursor-pointer"
                  style={{
                    colorScheme: 'light',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                />
              </div>
              <Button onClick={applyDateFilter} className="bg-fatima-green hover:bg-fatima-green/90 text-white">
                <Calendar className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button 
                onClick={() => {
                  setDateFilter({ from: '', to: '' });
                  loadPurchases();
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading purchase bills...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">S.No</TableHead>
                    <TableHead className="min-w-[120px]">Bill No</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[150px]">Supplier</TableHead>
                    <TableHead className="min-w-[120px]">Phone</TableHead>
                    <TableHead className="min-w-[200px]">Products</TableHead>
                    <TableHead className="min-w-[100px]">Payment Type</TableHead>
                    <TableHead className="min-w-[100px] text-right">Subtotal</TableHead>
                    <TableHead className="min-w-[100px] text-right">Discount</TableHead>
                    <TableHead className="min-w-[100px] text-right">Tax</TableHead>
                    <TableHead className="min-w-[120px] text-right">Total Amount</TableHead>
                    <TableHead className="min-w-[100px] text-right">Balance</TableHead>
                    <TableHead className="min-w-[80px] text-center">Status</TableHead>
                    <TableHead className="min-w-[140px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase, index) => (
                    <TableRow key={purchase.purchase_id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{purchase.bill_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(purchase.bill_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{purchase.supplier_name || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{purchase.supplier_phone || '-'}</TableCell>
                      <TableCell className="min-w-[200px]">
                        {purchase.items && purchase.items.length > 0 ? (
                          <div className="space-y-1">
                            {purchase.items.map((item, idx) => (
                              <div key={idx} className="text-xs bg-green-50 px-2 py-1 rounded border-l-2 border-l-fatima-green">
                                <div className="font-bold text-fatima-green text-sm" title={item.product_name}>
                                  {item.product_name}
                                </div>
                                <div className="text-gray-600">
                                  Qty: {parseFloat(item.quantity)} × ₹{parseFloat(item.rate).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No items</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                          purchase.payment_type === 'cash' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-green-100 text-blue-800'
                        }`}>
                          {purchase.payment_type.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">₹{(purchase.subtotal || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">₹{(purchase.discount_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">₹{(purchase.tax_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-right whitespace-nowrap">₹{purchase.total_amount.toLocaleString()}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${purchase.balance_amount > 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                        ₹{(purchase.balance_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                          purchase.is_cancelled 
                            ? 'bg-red-100 text-red-800'
                            : purchase.balance_amount > 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {purchase.is_cancelled ? 'Cancelled' : purchase.balance_amount > 0 ? 'Pending' : 'Paid'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => navigate(`/purchase/bill/${purchase.purchase_id}`)}
                            className="p-2 rounded-md transition-colors bg-fatima-green hover:bg-fatima-green/90 text-white flex items-center justify-center"
                            title="Edit Bill"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePurchase(purchase.purchase_id)}
                            className="p-2 rounded-md transition-colors flex items-center justify-center"
                            style={{backgroundColor: '#ef4444', color: 'white'}}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                            title="Delete Bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        No purchase bills found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseList;