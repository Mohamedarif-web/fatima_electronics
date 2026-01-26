import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Edit, Trash2, Search, Database } from 'lucide-react';
import db from '../../utils/database';
import { addTestItems, forceAddTestItems } from '../../utils/testData';

const ItemMaster = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    product_name: '',
    item_code: '',
    hsn_code: '',
    unit: 'PCS',
    sale_price: '',
    sale_price_type: 'without_tax',
    purchase_price: '',
    purchase_price_type: 'without_tax',
    gst_rate: '',
    opening_stock: '',
    current_stock: '',
    min_stock: ''
  });

  useEffect(() => {
    // Always load fresh items data when component mounts or searchParams change
    loadItems();
    
    // Check if we should auto-open the add form
    const shouldAddItem = searchParams.get('add') === 'true';
    if (shouldAddItem) {
      console.log('🎯 Opening form from navigation - ensuring fresh data');
      // Force another fresh load when opening form from navigation to prevent stale data
      setTimeout(() => loadItems(), 100);
      setShowForm(true);
    }
  }, [searchParams]);

  // Force refresh items when navigating back to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page is now visible, refresh data to ensure it's current
        console.log('🔄 Page visible - refreshing items data');
        loadItems();
      }
    };

    const handleFocus = () => {
      // Window gained focus, refresh data
      console.log('🔄 Window focused - refreshing items data');
      loadItems();
    };

    // Listen for visibility changes and focus events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await db.getItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        ...formData,
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        gst_rate: parseFloat(formData.gst_rate) || 0,
        opening_stock: parseFloat(formData.opening_stock) || 0,
        current_stock: parseFloat(formData.current_stock) || 0,
        min_stock: parseFloat(formData.min_stock) || 0
      };

      if (editingItem) {
        itemData.item_id = editingItem.item_id;
      }

      // Check for duplicate item code (only if item_code is provided and not editing the same item)
      if (formData.item_code && formData.item_code.trim()) {
        // First check local items array (fast check)
        const existingItem = items.find(item => 
          item.item_code && 
          item.item_code.toLowerCase() === formData.item_code.toLowerCase() &&
          (!editingItem || item.item_id !== editingItem.item_id)
        );
        
        if (existingItem) {
          alert(`Item code "${formData.item_code}" already exists for product "${existingItem.product_name}". Please use a different item code.`);
          return;
        }

        // Also check database directly for real-time validation
        try {
          const dbExistingItem = await db.get(
            'SELECT item_id, product_name, item_code FROM items WHERE LOWER(item_code) = ? AND is_deleted = 0' + 
            (editingItem ? ' AND item_id != ?' : ''),
            editingItem ? [formData.item_code.toLowerCase(), editingItem.item_id] : [formData.item_code.toLowerCase()]
          );
          
          if (dbExistingItem) {
            alert(`Item code "${formData.item_code}" already exists in database for product "${dbExistingItem.product_name}". Please use a different item code.`);
            return;
          }
        } catch (dbError) {
          console.warn('Could not verify item code in database:', dbError);
          // Continue with save attempt - let the database constraint handle it
        }
      }

      await db.saveItem(itemData);
      await loadItems();
      
      // Check where user came from and redirect back appropriately
      const cameFromSales = searchParams.get('add') === 'true' && searchParams.get('from') !== 'purchase';
      const cameFromPurchase = searchParams.get('add') === 'true' && searchParams.get('from') === 'purchase';
      
      if (cameFromSales) {
        alert('Item saved successfully! Redirecting back to sales invoice...');
        navigate('/sales/invoice');
        return;
      }
      
      if (cameFromPurchase) {
        alert('Item saved successfully! Redirecting back to purchase invoice...');
        navigate('/purchase/bill');
        return;
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving item:', error);
      
      // Handle specific constraint errors
      if (error.message && error.message.includes('UNIQUE constraint failed: items.item_code')) {
        alert(`❌ Item Code Conflict!\n\nThe item code "${formData.item_code}" is already being used by another product.\n\nThis can happen when:\n• Multiple users are adding items simultaneously\n• The item was recently added by someone else\n\nPlease try:\n1. Click "Generate" to create a new unique code\n2. Or manually enter a different item code\n3. Or leave the item code empty (optional field)`);
        
        // Refresh items to get latest data
        await loadItems();
      } else {
        alert('Error saving item: ' + error.message);
      }
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name || '',
      item_code: item.item_code || '',
      hsn_code: item.hsn_code || '',
      unit: item.unit || 'PCS',
      sale_price: item.sale_price || '',
      sale_price_type: item.sale_price_type || 'without_tax',
      purchase_price: item.purchase_price || '',
      purchase_price_type: item.purchase_price_type || 'without_tax',
      gst_rate: item.gst_rate || '',
      opening_stock: item.opening_stock || '',
      current_stock: item.current_stock || '',
      min_stock: item.min_stock || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await db.deleteItem(itemId);
        await loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item: ' + error.message);
      }
    }
  };

  const generateUniqueItemCode = async () => {
    if (!formData.product_name.trim()) {
      alert('Please enter product name first to generate item code');
      return;
    }
    
    const baseCode = formData.product_name
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, '') || 'ITM';
    
    let counter = 1;
    let newCode = `${baseCode}${String(counter).padStart(3, '0')}`;
    
    try {
      // Check against database for real-time uniqueness
      while (true) {
        // First check local items (faster)
        const localExists = items.some(item => 
          item.item_code && item.item_code.toLowerCase() === newCode.toLowerCase()
        );
        
        if (!localExists) {
          // Then check database
          const dbExists = await db.get(
            'SELECT item_id FROM items WHERE LOWER(item_code) = ? AND is_deleted = 0',
            [newCode.toLowerCase()]
          );
          
          if (!dbExists) {
            break; // Found unique code
          }
        }
        
        counter++;
        newCode = `${baseCode}${String(counter).padStart(3, '0')}`;
        
        // Safety check to prevent infinite loop
        if (counter > 999) {
          newCode = `${baseCode}${Date.now().toString().slice(-6)}`;
          break;
        }
      }
    } catch (error) {
      console.warn('Database check failed, using local check only:', error);
      // Fallback to local check only
      while (items.some(item => item.item_code && item.item_code.toLowerCase() === newCode.toLowerCase())) {
        counter++;
        newCode = `${baseCode}${String(counter).padStart(3, '0')}`;
      }
    }
    
    setFormData(prev => ({ ...prev, item_code: newCode }));
    console.log(`✅ Generated unique item code: ${newCode}`);
  };

  const resetForm = () => {
    // Check where user came from and redirect back appropriately
    const cameFromSales = searchParams.get('add') === 'true' && searchParams.get('from') !== 'purchase';
    const cameFromPurchase = searchParams.get('add') === 'true' && searchParams.get('from') === 'purchase';
    
    if (cameFromSales) {
      navigate('/sales/invoice');
      return;
    }
    
    if (cameFromPurchase) {
      navigate('/purchase/bill');
      return;
    }
    
    setFormData({
      product_name: '',
      item_code: '',
      hsn_code: '',
      unit: 'PCS',
      sale_price: '',
      sale_price_type: 'without_tax',
      purchase_price: '',
      purchase_price_type: 'without_tax',
      gst_rate: '',
      opening_stock: '',
      current_stock: '',
      min_stock: ''
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleAddTestItems = async () => {
    if (confirm('Add 10 test items to the database? This will add sample electronics items.')) {
      setLoading(true);
      try {
        const added = await forceAddTestItems();
        if (added) {
          alert('✅ Successfully added 10 test items!');
          loadItems(); // Refresh the items list
        }
      } catch (error) {
        alert('❌ Error adding test items: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredItems = items.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

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

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Modern Header */}
          <div className="flex items-center justify-between bg-white rounded-2xl shadow-lg p-6 border-0">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-100 to-green-100">
                <Plus className="w-8 h-8 text-fatima-green" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {editingItem ? 'Update item information' : 'Create a new product item'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={resetForm}
              className="px-6 py-3 border-2 border-gray-300 hover:border-red-300 hover:text-red-600 transition-all duration-200"
            >
              Cancel
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-fatima-green to-green-600 p-6">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                  Basic Information
                </CardTitle>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="product_name"
                      value={formData.product_name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="Enter product name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Item Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="item_code"
                        value={formData.item_code}
                        onChange={handleInputChange}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                        placeholder="Enter item code or generate"
                      />
                      <button
                        type="button"
                        onClick={generateUniqueItemCode}
                        className="px-4 py-3 bg-fatima-green text-white rounded-xl hover:bg-fatima-green/90 transition-all duration-200 font-medium whitespace-nowrap"
                        title="Generate unique item code"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      name="hsn_code"
                      value={formData.hsn_code}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="Enter HSN code"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Unit
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium bg-white"
                    >
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="Nos">Nos (Numbers)</option>
                      <option value="KG">KG (Kilogram)</option>
                      <option value="METER">METER (Meter)</option>
                      <option value="LITER">LITER (Liter)</option>
                      <option value="BOX">BOX (Box)</option>
                      <option value="DOZEN">DOZEN (Dozen)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Information Section */}
            <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-fatima-green to-green-600 p-6">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  Pricing & Tax Information
                </CardTitle>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      GST Rate (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="gst_rate"
                        value={formData.gst_rate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                        placeholder="0.00"
                        step="0.01"
                      />
                      <span className="absolute right-4 top-3 text-gray-500 font-medium">%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Sale Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500 font-bold">₹</span>
                      <input
                        type="number"
                        name="sale_price"
                        value={formData.sale_price}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Sale Price Type
                    </label>
                    <select
                      name="sale_price_type"
                      value={formData.sale_price_type}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium bg-white"
                    >
                      <option value="without_tax">Without Tax</option>
                      <option value="with_tax">With Tax (Inclusive)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Purchase Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500 font-bold">₹</span>
                      <input
                        type="number"
                        name="purchase_price"
                        value={formData.purchase_price}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Purchase Price Type
                    </label>
                    <select
                      name="purchase_price_type"
                      value={formData.purchase_price_type}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium bg-white"
                    >
                      <option value="without_tax">Without Tax</option>
                      <option value="with_tax">With Tax</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Information Section */}
            <Card className="shadow-xl border-0 bg-white rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-fatima-green to-green-600 p-6">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                  Stock Management
                </CardTitle>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      {editingItem ? 'Current Stock' : 'Opening Stock'}
                    </label>
                    <input
                      type="number"
                      name={editingItem ? "current_stock" : "opening_stock"}
                      value={editingItem ? formData.current_stock : formData.opening_stock}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="0.000"
                      step="0.001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                      Minimum Stock
                    </label>
                    <input
                      type="number"
                      name="min_stock"
                      value={formData.min_stock}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fatima-green focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium"
                      placeholder="0.000"
                      step="0.001"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 bg-white rounded-2xl shadow-lg p-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={resetForm}
                className="px-8 py-3 border-2 border-gray-300 hover:border-red-300 hover:text-red-600 transition-all duration-200 font-semibold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="px-8 py-3 bg-gradient-to-r from-fatima-green to-green-600 hover:from-fatima-green hover:to-green-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {editingItem ? 'Update Item' : 'Save Item'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Item Master</h1>
        <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Item List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-input rounded-md w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading items...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>GST Rate (%)</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((item, index) => (
                  <TableRow key={item.item_id} className={item.current_stock <= item.min_stock ? 'bg-red-50 border-l-4 border-l-red-500' : ''}>
                    <TableCell className="font-medium">{indexOfFirstItem + index + 1}</TableCell>
                    <TableCell className="font-bold">
                      <span className={`${item.current_stock <= item.min_stock ? 'text-red-700' : 'text-fatima-green'} text-base`}>
                        {item.product_name}
                      </span>
                    </TableCell>
                    <TableCell>{item.item_code || '-'}</TableCell>
                    <TableCell>{item.hsn_code || '-'}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.gst_rate || 0}%</TableCell>
                    <TableCell>₹{item.sale_price || 0}</TableCell>
                    <TableCell>₹{item.purchase_price || 0}</TableCell>
                    <TableCell>{item.min_stock || 0}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-red-600 bg-red-100 px-2 py-1 rounded' : 'text-green-600'}`}>
                        {item.current_stock || 0}
                        {item.current_stock <= item.min_stock && <span className="ml-1 text-xs">⚠️</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 rounded-md transition-colors bg-fatima-green hover:bg-fatima-green/90 text-white flex items-center justify-center"
                          title="Edit Item"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.item_id)}
                          className="p-2 rounded-md transition-colors flex items-center justify-center"
                          style={{backgroundColor: '#ef4444', color: 'white'}}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {currentItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {filteredItems.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} items
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ItemMaster;