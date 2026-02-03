import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Building, DollarSign, CreditCard } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import db from '../../utils/database';
import showToast from '../../utils/toast';
import ConfirmDialog from '../../components/ui/confirm-dialog';

const SupplierMaster = () => {
  console.log('🎯 SupplierMaster component is rendering!');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    opening_balance: 0
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading suppliers with real-time balance calculation...');
      const data = await db.query(`
        SELECT 
          s.supplier_id,
          s.name,
          s.phone,
          s.address,
          s.opening_balance,
          s.opening_balance + 
          COALESCE(purchases.total_outstanding_purchases, 0) - 
          COALESCE(payments_out.total_payments_made, 0) as current_balance
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
        ORDER BY s.name ASC
      `);
      
      console.log('✅ Loaded suppliers with real-time calculated balances:', data.length);
      
      // Debug balance calculation
      data.forEach(supplier => {
        console.log(`👤 ${supplier.name}: Opening ₹${supplier.opening_balance} → Current ₹${supplier.current_balance?.toFixed(2) || '0.00'}`);
      });
      
      setSuppliers(data);
    } catch (error) {
      console.error('❌ Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast.warning('Please enter supplier name');
      return;
    }

    try {
      setLoading(true);
      
      if (editingSupplier) {
        // Update existing supplier including opening balance
        await db.run(`
          UPDATE suppliers 
          SET name = ?, phone = ?, address = ?, opening_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [formData.name, formData.phone, formData.address, parseFloat(formData.opening_balance) || 0, editingSupplier.supplier_id]);
        
        console.log('✅ Updated supplier:', formData.name);
      } else {
        // Create new supplier
        await db.run(`
          INSERT INTO suppliers (
            name, phone, address, opening_balance, current_balance, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          formData.name, 
          formData.phone, 
          formData.address, 
          parseFloat(formData.opening_balance) || 0,
          parseFloat(formData.opening_balance) || 0
        ]);
        
        console.log('✅ Created supplier:', formData.name);
      }

      resetForm();
      await loadSuppliers();
      showToast.success(editingSupplier ? 'Supplier updated successfully!' : 'Supplier added successfully!');
      
    } catch (error) {
      console.error('❌ Error saving supplier:', error);
      showToast.error('Error saving supplier: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const editSupplier = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      opening_balance: supplier.opening_balance || 0
    });
    setShowForm(true);
  };

  const handleDeleteClick = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      setLoading(true);
      await db.run('UPDATE suppliers SET is_deleted = 1 WHERE supplier_id = ?', [supplierToDelete.supplier_id]);
      console.log('🗑️ Deleted supplier:', supplierToDelete.name);
      await loadSuppliers();
      showToast.success('Supplier deleted successfully!');
    } catch (error) {
      console.error('❌ Error deleting supplier:', error);
      showToast.error('Error deleting supplier: ' + error.message);
    } finally {
      setLoading(false);
      setSupplierToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      opening_balance: 0
    });
    setEditingSupplier(null);
    setShowForm(false);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.phone && supplier.phone.includes(searchTerm))
  );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h1>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="Enter supplier address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Opening Balance {editingSupplier && "(Current: ₹" + (editingSupplier.opening_balance || 0).toFixed(2) + ")"}
                  </label>
                  <input
                    type="number"
                    name="opening_balance"
                    value={formData.opening_balance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="0.00"
                    step="0.01"
                  />
                  {editingSupplier && (
                    <p className="text-sm text-gray-600 mt-1">
                      Note: Changing opening balance will affect current balance calculations
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate summary statistics
  const totalSuppliers = suppliers.length;
  const totalOutstanding = suppliers.reduce((sum, supplier) => sum + (supplier.current_balance || 0), 0);
  const positiveOutstanding = suppliers.reduce((sum, supplier) => sum + (supplier.current_balance > 0 ? supplier.current_balance : 0), 0);
  const negativeOutstanding = suppliers.reduce((sum, supplier) => sum + (supplier.current_balance < 0 ? Math.abs(supplier.current_balance) : 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Supplier Master</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <Building className="w-6 h-6 text-fatima-green" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
              <p className="text-2xl font-bold text-gray-900">{totalSuppliers}</p>
              <p className="text-xs text-gray-500 mt-1">Active supplier accounts</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-orange-100">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">₹{Math.abs(totalOutstanding).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalOutstanding >= 0 ? 'Net receivable from suppliers' : 'Net payable to suppliers'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Supplier List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-input rounded-md w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Opening Balance</TableHead>
                <TableHead>Current Balance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSuppliers.map((supplier, index) => (
                <TableRow key={supplier.supplier_id}>
                  <TableCell className="font-medium">{indexOfFirstItem + index + 1}</TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{supplier.address || '-'}</TableCell>
                  <TableCell>₹{supplier.opening_balance.toFixed(2)}</TableCell>
                  <TableCell className={supplier.current_balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                    ₹{Math.abs(supplier.current_balance || 0).toFixed(2)}
                    {supplier.current_balance > 0 ? ' (Payable)' : ' (Paid)'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => editSupplier(supplier)}
                        className="h-8 w-8 p-0 bg-fatima-green hover:bg-fatima-green/90 text-white flex items-center justify-center"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <button
                        onClick={() => handleDeleteClick(supplier)}
                        className="h-8 w-8 p-0 rounded-md transition-colors flex items-center justify-center"
                        style={{backgroundColor: '#ef4444', color: 'white'}}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {currentSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No suppliers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredSuppliers.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSuppliers.length)} of {filteredSuppliers.length} suppliers
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={prevPage} disabled={currentPage === 1} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                <div className="flex space-x-1">
                  {currentPage > 3 && (<><button onClick={() => paginate(1)} className="px-3 py-2 text-sm font-medium rounded-md text-gray-500 bg-white border border-gray-300 hover:bg-gray-50">1</button>{currentPage > 4 && <span className="px-2 py-2 text-gray-500">...</span>}</>)}
                  {[...Array(totalPages)].map((_, i) => { const pageNum = i + 1; if (pageNum >= currentPage - 2 && pageNum <= currentPage + 2) { return (<button key={pageNum} onClick={() => paginate(pageNum)} className={`px-3 py-2 text-sm font-medium rounded-md ${currentPage === pageNum ? 'bg-fatima-green text-white' : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'}`}>{pageNum}</button>); } return null; })}
                  {currentPage < totalPages - 2 && (<>{currentPage < totalPages - 3 && <span className="px-2 py-2 text-gray-500">...</span>}<button onClick={() => paginate(totalPages)} className="px-3 py-2 text-sm font-medium rounded-md text-gray-500 bg-white border border-gray-300 hover:bg-gray-50">{totalPages}</button></>)}
                </div>
                <button onClick={nextPage} disabled={currentPage === totalPages} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete supplier "${supplierToDelete?.name}"?`}
        confirmText="Delete Supplier"
        cancelText="Cancel"
        variant="danger"
        details={[
          'Supplier will be marked as deleted',
          'Purchase history will be preserved',
          'This action cannot be undone'
        ]}
      />
    </div>
  );
};

export default SupplierMaster;