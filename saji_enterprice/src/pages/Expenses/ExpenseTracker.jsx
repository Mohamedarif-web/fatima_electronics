import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Search, Save, Edit, Trash2, Calendar, Settings, X } from 'lucide-react';
import db from '../../utils/database';
import showToast from '../../utils/toast';

const ExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Expense form state
  const [expenseData, setExpenseData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    description: '',
    amount: '',
    account_id: '',
    payment_mode: 'cash',
    bill_number: '',
    vendor_name: '',
    notes: ''
  });

  // Category form state
  const [categoryData, setCategoryData] = useState({
    category_name: '',
    description: ''
  });

  useEffect(() => {
    loadExpenses();
    loadAccounts();
    loadCategories();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await db.query('SELECT * FROM accounts WHERE is_deleted = 0 ORDER BY account_name');
      setAccounts(data);
      
      // Set default account if not already set
      if (data.length > 0 && !expenseData.account_id) {
        setExpenseData(prev => ({ 
          ...prev, 
          account_id: data[0].account_id 
        }));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await db.query('SELECT * FROM expense_categories WHERE is_deleted = 0 AND is_active = 1 ORDER BY category_name');
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          e.*,
          a.account_name,
          ec.category_name
        FROM expenses e
        LEFT JOIN accounts a ON e.account_id = a.account_id
        LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
        WHERE e.is_deleted = 0
        ORDER BY e.expense_date DESC, e.expense_id DESC
      `);
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExpenseData(prev => ({ ...prev, [name]: value }));
  };

  const saveExpense = async () => {
    if (!expenseData.category_id || !expenseData.description || !expenseData.amount) {
      showToast.warning('Please fill all required fields (category, description, amount).');
      return;
    }
    
    if (!expenseData.account_id) {
      showToast.warning('Please select an account to deduct the expense amount from.');
      return;
    }

    try {
      setLoading(true);
      
      const amount = parseFloat(expenseData.amount);
      
      if (isNaN(amount) || amount <= 0) {
        showToast.warning('Please enter a valid amount');
        return;
      }

      // Start transaction
      await db.run('BEGIN TRANSACTION');

      if (editingExpense) {
        // Update existing expense
        await db.run(`
          UPDATE expenses SET 
            expense_date = ?, category_id = ?, description = ?, amount = ?, 
            account_id = ?, payment_mode = ?, bill_number = ?, vendor_name = ?, 
            notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE expense_id = ?
        `, [
          expenseData.expense_date, expenseData.category_id, expenseData.description,
          amount, expenseData.account_id, expenseData.payment_mode,
          expenseData.bill_number || null, expenseData.vendor_name || null,
          expenseData.notes || null, editingExpense.expense_id
        ]);

        // Restore previous amount to old account
        if (editingExpense.account_id) {
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [editingExpense.amount, editingExpense.account_id]);
        }

        // Deduct new amount from new account
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [amount, expenseData.account_id]);

        showToast.success('Expense updated successfully!');
      } else {
        // Get next expense number
        const expenseNumber = await db.getNextSequence('expense');
        
        // Save expense record
        await db.run(`
          INSERT INTO expenses (
            expense_number, expense_date, category_id, description, amount, account_id,
            payment_mode, bill_number, vendor_name, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          expenseNumber, expenseData.expense_date, expenseData.category_id, 
          expenseData.description, amount, expenseData.account_id,
          expenseData.payment_mode, expenseData.bill_number || null, 
          expenseData.vendor_name || null, expenseData.notes || null
        ]);

        // Update account balance (decrease cash/bank) - only if account is selected
        if (expenseData.account_id) {
          console.log(`💰 Deducting expense ₹${amount} from account ${expenseData.account_id}`);
          await db.run(`
            UPDATE accounts 
            SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `, [amount, expenseData.account_id]);
          console.log(`✅ Account balance updated for expense`);
        } else {
          console.log(`⚠️ No account selected - expense recorded without bank deduction`);
        }

        showToast.success(`Expense ${expenseNumber} recorded successfully!`);
      }

      // Commit transaction
      await db.run('COMMIT');

      resetForm();
      await loadExpenses();

    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Error saving expense:', error);
      showToast.error('Error saving expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const editExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseData({
      expense_date: expense.expense_date,
      category_id: expense.category_id,
      description: expense.description,
      amount: expense.amount,
      account_id: expense.account_id,
      payment_mode: expense.payment_mode,
      bill_number: expense.bill_number || '',
      vendor_name: expense.vendor_name || '',
      notes: expense.notes || ''
    });
    setShowForm(true);
  };

  const deleteExpense = async (expense) => {
    if (window.confirm('Are you sure you want to delete this expense? This will restore the amount to the account balance.')) {
      try {
        setLoading(true);
        
        // Start transaction
        await db.run('BEGIN TRANSACTION');
        
        // Mark expense as deleted
        await db.run('UPDATE expenses SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE expense_id = ?', [expense.expense_id]);
        
        // Restore amount to account (add back the expense amount)
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [expense.amount, expense.account_id]);
        
        // Commit transaction
        await db.run('COMMIT');
        
        await loadExpenses();
        showToast.success('Expense deleted successfully and amount restored to account');
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        console.error('Error deleting expense:', error);
        showToast.error('Error deleting expense: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setExpenseData({
      expense_date: new Date().toISOString().split('T')[0],
      category_id: '',
      description: '',
      amount: '',
      account_id: accounts.length > 0 ? accounts[0].account_id : '',
      payment_mode: 'cash',
      bill_number: '',
      vendor_name: '',
      notes: ''
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  // Category Management Functions
  const saveCategory = async () => {
    if (!categoryData.category_name.trim()) {
      showToast.warning('Please enter a category name');
      return;
    }

    try {
      setLoading(true);

      if (editingCategory) {
        await db.run(`
          UPDATE expense_categories SET 
            category_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE category_id = ?
        `, [categoryData.category_name.trim(), categoryData.description?.trim() || null, editingCategory.category_id]);
        showToast.success('Category updated successfully!');
      } else {
        await db.run(`
          INSERT INTO expense_categories (category_name, description) 
          VALUES (?, ?)
        `, [categoryData.category_name.trim(), categoryData.description?.trim() || null]);
        showToast.success('Category added successfully!');
      }

      resetCategoryForm();
      await loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        showToast.error('This category name already exists');
      } else {
        showToast.error('Error saving category: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setCategoryData({
      category_name: category.category_name,
      description: category.description || ''
    });
  };

  const deleteCategory = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category? This will affect existing expenses using this category.')) {
      try {
        await db.run('UPDATE expense_categories SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?', [categoryId]);
        await loadCategories();
        showToast.success('Category deleted successfully');
      } catch (error) {
        console.error('Error deleting category:', error);
        showToast.error('Error deleting category: ' + error.message);
      }
    }
  };

  const toggleCategoryStatus = async (categoryId, currentStatus) => {
    try {
      await db.run('UPDATE expense_categories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?', [currentStatus ? 0 : 1, categoryId]);
      await loadCategories();
    } catch (error) {
      console.error('Error updating category status:', error);
      showToast.error('Error updating category status: ' + error.message);
    }
  };

  const resetCategoryForm = () => {
    setCategoryData({
      category_name: '',
      description: ''
    });
    setEditingCategory(null);
  };

  const applyDateFilter = async () => {
    if (!dateFilter.from || !dateFilter.to) {
      loadExpenses();
      return;
    }

    try {
      setLoading(true);
      const data = await db.query(`
        SELECT 
          e.*,
          a.account_name,
          ec.category_name
        FROM expenses e
        LEFT JOIN accounts a ON e.account_id = a.account_id
        LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
        WHERE e.is_deleted = 0 
        AND DATE(e.expense_date) >= DATE(?)
        AND DATE(e.expense_date) <= DATE(?)
        ORDER BY e.expense_date DESC, e.expense_id DESC
      `, [dateFilter.from, dateFilter.to]);
      setExpenses(data);
    } catch (error) {
      console.error('Error filtering expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTotalStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = filteredExpenses.filter(expense => expense.expense_date === today);
    const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Category breakdown
    const categoryTotals = {};
    filteredExpenses.forEach(expense => {
      const categoryName = expense.category_name || 'Unknown';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
    });
    
    return {
      totalExpenses: filteredExpenses.length,
      todayExpenses: todayExpenses.length,
      todayTotal,
      totalAmount,
      categoryTotals
    };
  };

  const stats = getTotalStats();

  // Category Management UI
  if (showCategoryManager) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Manage Categories</h1>
          <Button variant="outline" onClick={() => {setShowCategoryManager(false); resetCategoryForm();}}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryData.category_name}
                  onChange={(e) => setCategoryData(prev => ({ ...prev, category_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter category name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={categoryData.description}
                  onChange={(e) => setCategoryData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                onClick={saveCategory} 
                disabled={loading}
                className="bg-fatima-green hover:bg-fatima-green/90"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCategory ? 'Update Category' : 'Add Category'}
              </Button>
              <Button variant="outline" onClick={resetCategoryForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 🔥 FIX: Make category table horizontally scrollable */}
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">S.No</TableHead>
                    <TableHead className="min-w-[200px]">Category Name</TableHead>
                    <TableHead className="min-w-[250px]">Description</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Created</TableHead>
                    <TableHead className="min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {categories.map((category, index) => (
                  <TableRow key={category.category_id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{category.category_name}</TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${category.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(category.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editCategory(category)}
                          className="p-2 rounded-md bg-fatima-green text-white hover:bg-fatima-green/90 transition-colors"
                          title="Edit Category"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(category.category_id)}
                          className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No categories found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </div>
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
            {editingExpense ? 'Edit Expense' : 'Add Expense'}
          </h1>
          <Button variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Expense Date</label>
                <input
                  type="date"
                  name="expense_date"
                  value={expenseData.expense_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  name="amount"
                  value={expenseData.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <div className="flex gap-2">
                  <select
                    name="category_id"
                    value={expenseData.category_id}
                    onChange={handleInputChange}
                    className="flex-1 px-3 py-2 border border-input rounded-md"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowCategoryManager(true)}
                    className="px-3"
                    title="Manage Categories"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Account *</label>
                <select
                  name="account_id"
                  value={expenseData.account_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map(account => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name} (₹{account.current_balance?.toLocaleString() || '0'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  name="description"
                  value={expenseData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter expense description"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Mode</label>
                <select
                  name="payment_mode"
                  value={expenseData.payment_mode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bill Number</label>
                <input
                  type="text"
                  name="bill_number"
                  value={expenseData.bill_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter bill/receipt number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vendor/Payee</label>
                <input
                  type="text"
                  name="vendor_name"
                  value={expenseData.vendor_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter vendor or payee name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  name="notes"
                  value={expenseData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Additional notes (optional)"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                onClick={saveExpense} 
                disabled={loading}
                className="bg-fatima-green hover:bg-fatima-green/90"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingExpense ? 'Update Expense' : 'Save Expense'}
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
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCategoryManager(true)}
            className="bg-fatima-green hover:bg-fatima-green/90 text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Categories
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-fatima-green hover:bg-fatima-green/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">{stats.totalExpenses}</div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.todayExpenses}</div>
              <div className="text-sm text-muted-foreground">Today's Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fatima-green">₹{stats.todayTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Today's Amount</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">₹{stats.totalAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Amount</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md"
              />
            </div>
            
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fatima-green focus:border-transparent cursor-pointer"
                  placeholder="From date"
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <span className="text-gray-500 text-sm">to</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-fatima-green focus:border-transparent cursor-pointer"
                  placeholder="To date"
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
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
                variant="outline"
                onClick={() => {
                  setDateFilter({ from: '', to: '' });
                  loadExpenses();
                }}
                className="border-gray-300 hover:bg-gray-50"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading expenses...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">S.No</TableHead>
                    <TableHead className="min-w-[120px]">Expense No</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[120px]">Category</TableHead>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="min-w-[150px]">Vendor</TableHead>
                    <TableHead className="min-w-[120px]">Bill Number</TableHead>
                    <TableHead className="min-w-[120px]">Account</TableHead>
                    <TableHead className="min-w-[120px]">Payment Mode</TableHead>
                    <TableHead className="min-w-[100px]">Amount</TableHead>
                    <TableHead className="min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.expense_id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{expense.expense_number}</TableCell>
                    <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-blue-800">
                        {expense.category_name || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.vendor_name || '-'}</TableCell>
                    <TableCell>{expense.bill_number || '-'}</TableCell>
                    <TableCell>{expense.account_name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                        {expense.payment_mode.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-red-600">₹{expense.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editExpense(expense)}
                          className="p-2 rounded-md bg-fatima-green hover:bg-fatima-green/90 text-white transition-colors"
                          title="Edit Expense"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteExpense(expense)}
                          className="p-2 rounded-md transition-colors"
                          style={{backgroundColor: '#ef4444', color: 'white'}}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No expenses found
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

export default ExpenseTracker;