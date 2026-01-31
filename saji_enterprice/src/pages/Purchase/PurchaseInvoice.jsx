import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Trash2, Save, FileText, Search, Edit } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import db from '../../utils/database';
import showToast from '../../utils/toast';

const PurchaseInvoice = () => {
  const { purchaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  
  // Purchase invoice form state
  const [invoiceData, setInvoiceData] = useState({
    bill_date: new Date().toISOString().split('T')[0],
    bill_number: '',
    supplier_id: '',
    payment_type: 'cash',
    account_id: '', // User must select account
    notes: '',
    discount_amount: 0
  });

  // Accounts state
  const [accounts, setAccounts] = useState([]);

  // Payment tracking (same as sales invoice)
  const [paymentData, setPaymentData] = useState({
    account_id: '',
    amount_paid: 0,
    payment_date: new Date().toISOString().split('T')[0]
  });


  // Invoice items
  const [invoiceItems, setInvoiceItems] = useState([]);
  
  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  
  // Item search for adding items
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadItems();
    loadAccounts();
    
    // Restore saved purchase data when coming back from navigation
    restorePurchaseData();
  }, []);

  // Save current purchase data to localStorage
  const savePurchaseDataToStorage = () => {
    const dataToSave = {
      invoiceData,
      invoiceItems,
      supplierSearch,
      paymentData,
      timestamp: Date.now()
    };
    localStorage.setItem('tempPurchaseData', JSON.stringify(dataToSave));
    console.log('💾 Purchase data saved to localStorage');
  };

  // Restore purchase data from localStorage
  const restorePurchaseData = () => {
    try {
      const savedData = localStorage.getItem('tempPurchaseData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Check if data is less than 1 hour old
        const hoursSinceCreation = (Date.now() - parsedData.timestamp) / (1000 * 60 * 60);
        
        if (hoursSinceCreation < 1 && !isEditing) {
          setInvoiceData(parsedData.invoiceData || invoiceData);
          setInvoiceItems(parsedData.invoiceItems || []);
          setSupplierSearch(parsedData.supplierSearch || '');
          setPaymentData(parsedData.paymentData || paymentData);
          
          console.log('🔄 Purchase data restored from localStorage');
          
          // Clear the saved data after restoration
          localStorage.removeItem('tempPurchaseData');
        }
      }
    } catch (error) {
      console.error('Error restoring purchase data:', error);
      localStorage.removeItem('tempPurchaseData');
    }
  };

  useEffect(() => {
    // Check if editing mode from URL params or purchaseId
    const editId = searchParams.get('edit') || purchaseId;
    console.log('Search params:', searchParams.toString());
    console.log('Edit ID:', editId);
    
    if (editId && suppliers.length > 0 && items.length > 0) {
      console.log('Loading purchase for edit:', editId);
      setIsEditing(true);
      loadPurchaseForEdit(editId);
    }
  }, [suppliers, items, searchParams, purchaseId]);

  // Set supplier search when suppliers are loaded and we're editing
  useEffect(() => {
    if (isEditing && suppliers.length > 0 && invoiceData.supplier_id) {
      const supplier = suppliers.find(s => s.supplier_id === parseInt(invoiceData.supplier_id));
      if (supplier) {
        setSupplierSearch(supplier.name);
        setShowSupplierDropdown(false); // Hide dropdown when editing
        console.log(`👤 Set supplier for editing: ${supplier.name}`);
      } else {
        console.log(`⚠️ Supplier with ID ${invoiceData.supplier_id} not found in suppliers list`);
        console.log('Available suppliers:', suppliers.map(s => `${s.supplier_id}: ${s.name}`));
      }
    }
  }, [suppliers, isEditing, invoiceData.supplier_id]);

  // Debug effect to track invoice data changes
  useEffect(() => {
    if (isEditing) {
      console.log('🔍 Invoice data changed:', invoiceData);
      console.log('📦 Invoice items:', invoiceItems);
    }
  }, [invoiceData, invoiceItems, isEditing]);

  const loadAccounts = async () => {
    try {
      const data = await db.getAccounts();
      setAccounts(data);
      
      if (!data || data.length === 0) {
        showToast.warning('No bank accounts found. Please create accounts in Bank/Cash management first.');
      }
      
      console.log('📋 Loaded accounts for purchase:', data.map(acc => ({ id: acc.account_id, name: acc.account_name })));
    } catch (error) {
      console.error('Error loading accounts:', error);
      showToast.error('Failed to load bank accounts. Please create accounts in Bank/Cash management first.');
      setAccounts([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      console.log('🔄 Loading suppliers from suppliers table for purchase...');
      
      // Query the dedicated suppliers table
      const data = await db.query(`
        SELECT 
          supplier_id,
          name,
          phone,
          address,
          opening_balance,
          current_balance
        FROM suppliers
        WHERE is_deleted = 0
        ORDER BY name ASC
      `);
      
      console.log('✅ Loaded suppliers from suppliers table:', data.length);
      
      if (data.length === 0) {
        console.log('⚠️ No suppliers found! Checking suppliers table...');
        const debug = await db.query('SELECT supplier_id, name, is_deleted FROM suppliers');
        console.log('📊 Suppliers in database:', debug);
      }
      
      // Debug loaded suppliers
      data.forEach((supplier, index) => {
        console.log(`👤 ${index + 1}. ${supplier.name}: ID=${supplier.supplier_id} Balance=₹${supplier.current_balance?.toFixed(2) || '0.00'}`);
      });
      
      setSuppliers(data);
    } catch (error) {
      console.error('❌ Error loading suppliers:', error);
      showToast.error('Error loading suppliers: ' + error.message);
    }
  };

  const loadItems = async () => {
    try {
      const data = await db.getItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const loadPurchaseForEdit = async (purchaseId) => {
    try {
      setLoading(true);
      console.log(`🔄 Loading purchase ${purchaseId} for editing...`);
      console.log('🔍 Purchase ID type:', typeof purchaseId, 'Value:', purchaseId);
      
      // Load purchase header
      const purchase = await db.get(`
        SELECT * FROM purchase_invoices WHERE purchase_id = ? AND is_deleted = 0
      `, [purchaseId]);
      
      if (!purchase) {
        console.log('❌ Purchase not found for ID:', purchaseId);
        console.log('🔍 Available purchases in DB:');
        const allPurchases = await db.query('SELECT purchase_id, bill_number FROM purchase_invoices WHERE is_deleted = 0');
        console.log(allPurchases);
        showToast.error(`Purchase invoice ${purchaseId} not found.`);
        navigate('/purchase');
        return;
      }
      
      console.log('📄 Purchase data loaded:', purchase);
      console.log('Setting editing purchase:', purchase);
      setEditingPurchase(purchase);
      
      // Check if this is the right purchase
      if (purchase.purchase_id !== parseInt(purchaseId)) {
        console.log('⚠️ Mismatch! Requested:', purchaseId, 'Got:', purchase.purchase_id);
      }
      
      // Load purchase items with proper item details
      const purchaseItems = await db.query(`
        SELECT 
          pii.*, 
          i.product_name, 
          i.current_stock,
          i.purchase_price,
          i.sale_price,
          i.gst_rate
        FROM purchase_invoice_items pii
        LEFT JOIN items i ON pii.item_id = i.item_id
        WHERE pii.purchase_id = ? AND i.is_deleted = 0
      `, [purchaseId]);
      
      console.log('📦 Purchase items loaded:', purchaseItems);
      
      // Set invoice data - ensure all fields are properly set
      const invoiceDataToSet = {
        purchase_id: purchase.purchase_id,
        bill_date: purchase.bill_date,
        bill_number: purchase.bill_number || '',
        supplier_id: purchase.supplier_id,
        payment_type: purchase.payment_type || 'cash',
        account_id: purchase.account_id || '',
        notes: purchase.notes || '',
        discount_amount: parseFloat(purchase.discount_amount) || 0
      };
      
      console.log('🔧 Setting invoice data from purchase:', invoiceDataToSet);
      setInvoiceData(invoiceDataToSet);
      
      // Set payment data from purchase invoice
      setPaymentData({
        account_id: purchase.account_id || '',
        amount_paid: parseFloat(purchase.paid_amount) || 0,
        payment_date: purchase.bill_date || new Date().toISOString().split('T')[0]
      });
      console.log('💰 Setting payment data:', {
        account_id: purchase.account_id,
        amount_paid: purchase.paid_amount,
        payment_date: purchase.bill_date
      });
      
      // Load purchase items with fresh product details directly from database (like sales invoice)
      if (purchaseItems.length > 0) {
        console.log('🔄 Loading fresh stock data directly from database...');
        const itemsWithDetails = await Promise.all(
          purchaseItems.map(async (item) => {
            // Get fresh product data directly from database (no cache)
            let product;
            try {
              product = await db.getItemById(item.item_id);
            } catch (error) {
              console.log('getItemById not available, using direct query');
              product = await db.get('SELECT * FROM items WHERE item_id = ?', [item.item_id]);
            }
            console.log(`📦 ${product.product_name}: Fresh stock loaded ${product.current_stock}`);
            return {
              ...product,
              item_id: item.item_id,
              product_name: product.product_name || item.product_name || 'Unknown Item',
              current_stock: parseFloat(product.current_stock) || 0,
              quantity: parseFloat(item.quantity) || 0,
              original_quantity: parseFloat(item.quantity) || 0, // Store original for calculations
              rate: parseFloat(item.rate) || 0,
              discount_percent: parseFloat(item.discount_percent) || 0,
              tax_rate: parseFloat(item.tax_rate) || parseFloat(product.gst_rate) || 0
            };
          })
        );
        
        console.log('✅ Items loaded with fresh stock data:', itemsWithDetails);
        setInvoiceItems(itemsWithDetails);
      } else {
        setInvoiceItems([]);
      }
      
      // Set supplier search field after a short delay to ensure suppliers are loaded
      setTimeout(() => {
        if (suppliers.length > 0 && purchase.supplier_id) {
          const supplier = suppliers.find(s => s.supplier_id === parseInt(purchase.supplier_id));
          if (supplier) {
            setSupplierSearch(supplier.name);
            console.log(`👤 Set supplier search to: ${supplier.name}`);
          } else {
            console.log(`⚠️ Supplier not found in loaded suppliers for ID: ${purchase.supplier_id}`);
          }
        }
      }, 500);
      
      console.log('✅ Purchase data loaded successfully for editing');
      
    } catch (error) {
      console.error('❌ Error loading purchase for edit:', error);
      showToast.error('Error loading purchase invoice: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInvoiceData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const selectSupplier = (supplier) => {
    console.log('🎯 Selecting supplier:', supplier.name);
    setInvoiceData(prev => ({ ...prev, supplier_id: supplier.supplier_id }));
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
    console.log('✅ Supplier selected and dropdown closed');
  };

  const addItem = (item) => {
    console.log('🔍 Adding item:', item.product_name, 'ID:', item.item_id);
    console.log('🔍 Current items:', invoiceItems.map(i => `${i.product_name}(${i.item_id})`));
    
    const existingItemIndex = invoiceItems.findIndex(i => parseInt(i.item_id) === parseInt(item.item_id));
    console.log('🔍 Existing item index:', existingItemIndex);
    
    if (existingItemIndex !== -1) {
      // Increase quantity if item already exists
      setInvoiceItems(prev => 
        prev.map((i, index) => 
          index === existingItemIndex
            ? { ...i, quantity: parseFloat(i.quantity || 0) + 1 }
            : i
        )
      );
      console.log(`📦 Updated existing item: ${item.product_name} - increased quantity by 1`);
    } else {
      // Add new item with auto-loaded price
      const defaultPrice = parseFloat(item.purchase_price) || parseFloat(item.sale_price) || 0;
      const newItem = {
        item_id: parseInt(item.item_id), // Ensure consistent data type
        product_name: item.product_name,
        current_stock: item.current_stock || 0,
        quantity: 1,
        rate: defaultPrice,
        discount_percent: 0,
        tax_rate: item.gst_rate || 0
      };
      console.log(`📦 Added new item: ${item.product_name} (Stock: ${item.current_stock || 0}, Price: ₹${newItem.rate})`);
      setInvoiceItems(prev => [...prev, newItem]);
    }
    
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const updateInvoiceItem = (index, field, value) => {
    setInvoiceItems(prev => 
      prev.map((item, i) => {
        if (i === index) {
          if (field === 'quantity') {
            // Handle quantity changes - preserve user input and allow empty string
            let newValue = value;
            if (value !== '') {
              const parsedValue = parseFloat(value);
              if (!isNaN(parsedValue) && parsedValue >= 0) {
                newValue = parsedValue;
              } else {
                // Keep the previous value if input is invalid
                newValue = item.quantity;
              }
            }
            return { ...item, [field]: newValue };
          } else {
            // For other fields, use original logic
            return { ...item, [field]: parseFloat(value) || 0 };
          }
        }
        return item;
      })
    );
  };

  const removeItem = (index) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate totals from items
  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      return sum + (quantity * rate);
    }, 0);
    
    const discount = parseFloat(invoiceData.discount_amount) || 0;
    const total = subtotal - discount;
    
    return { subtotal, discount, total };
  };

  const { subtotal, discount, total } = calculateTotals();

  const calculateItemAmount = (item) => {
    const baseAmount = item.quantity * item.rate;
    const discountAmount = baseAmount * (item.discount_percent / 100);
    const taxableAmount = baseAmount - discountAmount;
    const taxAmount = taxableAmount * (item.tax_rate / 100);
    const totalAmount = taxableAmount + taxAmount;

    return {
      baseAmount,
      discountAmount,
      taxableAmount,
      taxAmount,
      totalAmount
    };
  };

  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;
    let totalAmount = 0;

    invoiceItems.forEach(item => {
      const calc = calculateItemAmount(item);
      subtotal += calc.baseAmount;
      totalDiscountAmount += calc.discountAmount;
      totalTaxAmount += calc.taxAmount;
      totalAmount += calc.totalAmount;
    });

    // Apply invoice level discount
    const invoiceDiscountAmount = parseFloat(invoiceData.discount_amount) || 0;
    const finalTotal = totalAmount - invoiceDiscountAmount;

    return {
      subtotal,
      totalDiscountAmount: totalDiscountAmount + invoiceDiscountAmount,
      totalTaxAmount,
      totalAmount: finalTotal
    };
  };

  const validateInvoice = () => {
    if (!invoiceData.supplier_id) {
      showToast.warning('Please select a supplier');
      return false;
    }

    if (!invoiceData.bill_number.trim()) {
      showToast.warning('Please enter bill number');
      return false;
    }

    if (invoiceItems.length === 0) {
      showToast.warning('Please add at least one item');
      return false;
    }

    // Payment section is now optional - no account validation required

    // Validate payment details (only if payment amount is specified)
    if (paymentData.amount_paid > 0 && paymentData.account_id) {
      const selectedAccount = accounts.find(acc => acc.account_id === parseInt(paymentData.account_id));
      if (selectedAccount) {
        let availableBalance = parseFloat(selectedAccount.current_balance || 0);
        
        // If editing, add back the previous payment to get the real available balance
        if (isEditing && editingPurchase && editingPurchase.paid_amount > 0 && 
            editingPurchase.account_id === parseInt(paymentData.account_id)) {
          availableBalance += parseFloat(editingPurchase.paid_amount);
          console.log(`🔧 Editing mode: Adding back previous payment ₹${editingPurchase.paid_amount} to balance check`);
          console.log(`💰 Adjusted available balance: ₹${availableBalance.toFixed(2)}`);
        }
        
        if (availableBalance < paymentData.amount_paid) {
          showToast.error(`Insufficient balance in ${selectedAccount.account_name}. Available: ₹${availableBalance.toFixed(2)}, Payment Amount: ₹${paymentData.amount_paid.toFixed(2)}`);
          return false;
        }
      }
    }

    return true;
  };

  const saveInvoice = async () => {
    if (!validateInvoice()) return;

    try {
      setLoading(true);
      
      if (isEditing) {
        await updateInvoice();
      } else {
        await createInvoice();
      }
      
    } catch (error) {
      console.error('Error saving purchase invoice:', error);
      showToast.error('Error saving purchase bill: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createInvoice = async () => {
    const totals = calculateInvoiceTotals();
    
    // Prepare purchase invoice data
    const invoice = {
      bill_number: invoiceData.bill_number,
      bill_date: invoiceData.bill_date,
      supplier_id: invoiceData.supplier_id,
      payment_type: invoiceData.payment_type,
      account_id: paymentData.account_id || null,
      subtotal: totals.subtotal,
      discount_amount: totals.totalDiscountAmount,
      tax_amount: totals.totalTaxAmount,
      total_amount: totals.totalAmount,
      paid_amount: paymentData.amount_paid || 0,
      balance_amount: Math.max(0, totals.totalAmount - (paymentData.amount_paid || 0)),
      notes: invoiceData.notes
    };

      // Prepare invoice items with calculations
      const itemsWithCalculations = invoiceItems.map(item => {
        const calc = calculateItemAmount(item);
        return {
          item_id: item.item_id,
          quantity: item.quantity,
          rate: item.rate,
          discount_percent: item.discount_percent,
          discount_amount: calc.discountAmount,
          taxable_amount: calc.taxableAmount,
          tax_rate: item.tax_rate,
          tax_amount: calc.taxAmount,
          total_amount: calc.totalAmount
        };
      });

      // Save invoice with transaction
      const operations = [];
      
      // Insert purchase invoice
      operations.push({
        sql: `INSERT INTO purchase_invoices (
          bill_number, bill_date, supplier_id, payment_type, account_id,
          subtotal, discount_amount, tax_amount, total_amount, paid_amount, 
          balance_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          invoice.bill_number, invoice.bill_date, invoice.supplier_id,
          invoice.payment_type, invoice.account_id, invoice.subtotal,
          invoice.discount_amount, invoice.tax_amount, invoice.total_amount,
          invoice.paid_amount, invoice.balance_amount, invoice.notes
        ]
      });

      await db.transaction(operations);
      
      // Get the purchase ID and save items
      const savedInvoice = await db.get(
        'SELECT purchase_id FROM purchase_invoices WHERE bill_number = ? AND supplier_id = ?',
        [invoice.bill_number, invoice.supplier_id]
      );

      // Save invoice items and update stock
      for (const item of itemsWithCalculations) {
        await db.run(`
          INSERT INTO purchase_invoice_items (
            purchase_id, item_id, quantity, rate, discount_percent, discount_amount,
            taxable_amount, tax_rate, tax_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          savedInvoice.purchase_id, item.item_id, item.quantity, item.rate,
          item.discount_percent, item.discount_amount, item.taxable_amount,
          item.tax_rate, item.tax_amount, item.total_amount
        ]);

        // Update stock (increase for purchase)
        const currentStock = parseFloat(item.quantity) || 0;
        await db.run(`
          UPDATE items 
          SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
          WHERE item_id = ?
        `, [currentStock, item.item_id]);
        
        console.log(`📦 Stock increased for ${item.product_name}: +${currentStock} units`);

        // Record stock movement
        await db.run(`
          INSERT INTO stock_movements (
            item_id, movement_type, reference_type, reference_id, quantity, 
            rate, movement_date, description
          ) VALUES (?, 'in', 'purchase', ?, ?, ?, ?, ?)
        `, [
          item.item_id, savedInvoice.purchase_id, item.quantity, item.rate,
          invoiceData.bill_date, `Purchase Bill ${invoice.bill_number}`
        ]);
      }

      // Update supplier balance with remaining amount due
      const balanceAmount = invoice.total_amount - (paymentData.amount_paid || 0);
      if (balanceAmount > 0) {
        try {
          await db.run(`
            UPDATE suppliers 
            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE supplier_id = ?
          `, [balanceAmount, invoice.supplier_id]);
        } catch (error) {
          // Fallback to parties table if suppliers table doesn't have balance tracking
          console.log('Using parties table for supplier balance');
          await db.run(`
            UPDATE parties 
            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE party_id = ?
          `, [balanceAmount, invoice.supplier_id]);
        }
      }

      // Handle payment to bank account
      if (paymentData.amount_paid > 0 && paymentData.account_id) {
        console.log(`💰 Processing payment: Deducting ₹${paymentData.amount_paid} from account ${paymentData.account_id}`);
        console.log(`📊 Total invoice amount: ₹${invoice.total_amount}, Payment: ₹${paymentData.amount_paid}, Balance due: ₹${invoice.balance_amount}`);
        await db.run(`
          UPDATE accounts 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ?
        `, [paymentData.amount_paid, paymentData.account_id]);

        // Record payment transaction (skip party_id for suppliers)
        try {
          await db.run(`
            INSERT INTO payment_transactions (
              reference_type, reference_id, account_id, payment_type, 
              amount, payment_date, payment_method, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            'purchase_invoice', savedInvoice.purchase_id, paymentData.account_id,
            'payment_out', paymentData.amount_paid, paymentData.payment_date, 'bank_transfer',
            `Payment for purchase bill ${invoice.bill_number}`
          ]);
        } catch (error) {
          console.log('Payment transactions creation failed:', error.message);
        }
      }

    showToast.success(`Purchase Bill ${invoice.bill_number} saved successfully!`);
    resetForm();
  };

  const updateInvoice = async () => {
    const totals = calculateInvoiceTotals();
    
    // First, reverse the previous stock and balance changes
    const originalPurchase = await db.get('SELECT * FROM purchase_invoices WHERE purchase_id = ?', [invoiceData.purchase_id]);
    const originalItems = await db.query('SELECT * FROM purchase_invoice_items WHERE purchase_id = ?', [invoiceData.purchase_id]);
    
    // Reverse stock changes
    for (const item of originalItems) {
      await db.run(`
        UPDATE items 
        SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = ?
      `, [item.quantity, item.item_id]);
    }
    
    // Reverse previous payment changes (always reverse if there was a payment)
    if (originalPurchase.paid_amount > 0 && originalPurchase.account_id) {
      console.log(`🔄 Reversing payment: +₹${originalPurchase.paid_amount} to account ${originalPurchase.account_id}`);
      await db.run(`
        UPDATE accounts 
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `, [parseFloat(originalPurchase.paid_amount), originalPurchase.account_id]);
    }

    // Reverse previous supplier balance
    const originalBalance = originalPurchase.total_amount - (originalPurchase.paid_amount || 0);
    if (originalBalance > 0) {
      try {
        await db.run(`
          UPDATE suppliers 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [originalBalance, originalPurchase.supplier_id]);
      } catch (error) {
        // Fallback to parties table
        await db.run(`
          UPDATE parties 
          SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
          WHERE party_id = ?
        `, [originalBalance, originalPurchase.supplier_id]);
      }
    }
    
    // Update purchase invoice
    const invoice = {
      bill_number: invoiceData.bill_number,
      bill_date: invoiceData.bill_date,
      supplier_id: invoiceData.supplier_id,
      payment_type: invoiceData.payment_type,
      account_id: paymentData.account_id || null,
      subtotal: totals.subtotal,
      discount_amount: totals.totalDiscountAmount,
      tax_amount: totals.totalTaxAmount,
      total_amount: totals.totalAmount,
      paid_amount: paymentData.amount_paid || 0,
      balance_amount: Math.max(0, totals.totalAmount - (paymentData.amount_paid || 0)),
      notes: invoiceData.notes
    };
    
    await db.run(`
      UPDATE purchase_invoices SET
        bill_number = ?, bill_date = ?, supplier_id = ?, payment_type = ?, account_id = ?,
        subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?, 
        paid_amount = ?, balance_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE purchase_id = ?
    `, [
      invoice.bill_number, invoice.bill_date, invoice.supplier_id,
      invoice.payment_type, invoice.account_id, invoice.subtotal,
      invoice.discount_amount, invoice.tax_amount, invoice.total_amount,
      invoice.paid_amount, invoice.balance_amount, invoice.notes,
      invoiceData.purchase_id
    ]);
    
    // Delete old items
    await db.run('DELETE FROM purchase_invoice_items WHERE purchase_id = ?', [invoiceData.purchase_id]);
    
    // Insert new items and update stock
    const itemsWithCalculations = invoiceItems.map(item => {
      const calc = calculateItemAmount(item);
      return {
        item_id: item.item_id,
        quantity: item.quantity,
        rate: item.rate,
        discount_percent: item.discount_percent,
        discount_amount: calc.discountAmount,
        taxable_amount: calc.taxableAmount,
        tax_rate: item.tax_rate,
        tax_amount: calc.taxAmount,
        total_amount: calc.totalAmount
      };
    });
    
    for (const item of itemsWithCalculations) {
      await db.run(`
        INSERT INTO purchase_invoice_items (
          purchase_id, item_id, quantity, rate, discount_percent, discount_amount,
          taxable_amount, tax_rate, tax_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceData.purchase_id, item.item_id, item.quantity, item.rate,
        item.discount_percent, item.discount_amount, item.taxable_amount,
        item.tax_rate, item.tax_amount, item.total_amount
      ]);

      // Update stock (increase for purchase)
      await db.run(`
        UPDATE items 
        SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = ?
      `, [item.quantity, item.item_id]);
    }

    // Apply new payment changes (only if amount > 0)
    if (paymentData.amount_paid > 0 && paymentData.account_id) {
      console.log(`💰 Applying payment: -₹${paymentData.amount_paid} from account ${paymentData.account_id}`);
      await db.run(`
        UPDATE accounts 
        SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `, [parseFloat(paymentData.amount_paid), paymentData.account_id]);

      // Delete old payment transactions for this invoice before creating new one
      try {
        await db.run(`
          DELETE FROM payment_transactions 
          WHERE reference_type = 'purchase_invoice' AND reference_id = ?
        `, [invoiceData.purchase_id]);
        console.log('🗑️ Deleted old payment transactions for invoice');
        
        // Record new payment transaction only if amount > 0 (skip party_id for suppliers)
        if (paymentData.amount_paid > 0) {
          await db.run(`
            INSERT INTO payment_transactions (
              reference_type, reference_id, account_id, payment_type, 
              amount, payment_date, payment_method, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            'purchase_invoice', invoiceData.purchase_id, paymentData.account_id,
            'payment_out', paymentData.amount_paid, paymentData.payment_date, 'bank_transfer',
            `Payment for purchase bill ${invoice.bill_number}`
          ]);
          console.log('💾 Created new payment transaction:', paymentData.amount_paid);
        }
      } catch (error) {
        console.log('Payment transactions table not available, payment recorded in account balance only');
      }
    }

    // Apply new supplier balance
    const newBalance = invoice.total_amount - (paymentData.amount_paid || 0);
    if (newBalance > 0) {
      try {
        await db.run(`
          UPDATE suppliers 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [newBalance, invoice.supplier_id]);
      } catch (error) {
        // Fallback to parties table
        await db.run(`
          UPDATE parties 
          SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE party_id = ?
        `, [newBalance, invoice.supplier_id]);
      }
    }

    showToast.success(`Purchase Bill ${invoice.bill_number} updated successfully!`);
    navigate('/purchase');
  };

  const resetForm = () => {
    console.log('🔄 Resetting form to defaults');
    setInvoiceData({
      bill_date: new Date().toISOString().split('T')[0],
      bill_number: '',
      supplier_id: '',
      payment_type: 'cash',
      account_id: '', // User must select account
      notes: '',
      discount_amount: 0
    });
    setInvoiceItems([]);
    setSupplierSearch('');
    setItemSearch('');
    setIsEditing(false);
    setEditingPurchase(null);
    setShowSupplierDropdown(false);
    setShowItemDropdown(false);
    
    // Reset payment data
    setPaymentData({
      account_id: '',
      amount_paid: 0,
      payment_date: new Date().toISOString().split('T')[0]
    });
    
    // Clear URL params using React Router
    navigate('/purchase/bill', { replace: true });
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredItems = items.filter(item =>
    item.product_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const totals = calculateInvoiceTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Edit Purchase Invoice' : 'Purchase Invoice'}
          </h1>
          {editingPurchase && (
            <p className="text-sm text-muted-foreground mt-1">
              Editing: {editingPurchase.bill_number}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/purchase')}>
            <FileText className="w-4 h-4 mr-2" />
            Purchase List
          </Button>
          <Button variant="outline" onClick={resetForm}>
            <FileText className="w-4 h-4 mr-2" />
            New Bill
          </Button>
          <Button 
            onClick={saveInvoice} 
            disabled={loading}
            className="bg-fatima-green hover:bg-fatima-green/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Update Bill' : 'Save Bill'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Header */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Bill Date</label>
                <input
                  type="date"
                  name="bill_date"
                  value={invoiceData.bill_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Bill Number *</label>
                <input
                  type="text"
                  name="bill_number"
                  value={invoiceData.bill_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                  placeholder="Enter bill number"
                  required
                />
                {isEditing && (
                  <div className="text-xs text-gray-500 mt-1">
                    Debug: {JSON.stringify({bill_number: invoiceData.bill_number, payment_type: invoiceData.payment_type})}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Payment Type</label>
                <select
                  name="payment_type"
                  value={invoiceData.payment_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                >
                  <option value="cash">Cash Payment</option>
                  <option value="credit">Credit Purchase</option>
                </select>
              </div>
            </div>

            {/* Supplier Selection */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search and select supplier..."
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierDropdown(true);
                  }}
                  onFocus={() => {
                    console.log('Supplier field focused, showing dropdown');
                    setShowSupplierDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 300)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                />
              </div>
              
              
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-md max-h-60 overflow-auto" style={{
                  backgroundColor: '#ffffff', 
                  border: '2px solid #6b7280',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  marginTop: '4px'
                }}>
                  {filteredSuppliers.map((supplier) => (
                    <div
                      key={supplier.supplier_id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur event
                        e.stopPropagation(); // Stop event bubbling
                        console.log('🖱️ Mouse down on supplier:', supplier.name);
                        selectSupplier(supplier);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('👆 Click on supplier:', supplier.name);
                        selectSupplier(supplier);
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {supplier.phone} | Balance: ₹{Math.abs(supplier.current_balance || 0).toFixed(2)} {supplier.current_balance > 0 ? 'Payable' : 'Paid'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show message when no suppliers found */}
              {showSupplierDropdown && filteredSuppliers.length === 0 && suppliers.length === 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-md" style={{
                  backgroundColor: '#ffffff', 
                  border: '2px solid #6b7280',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  marginTop: '4px'
                }}>
                  <div className="px-4 py-2 text-red-600">
                    No suppliers found. Please add suppliers first.
                  </div>
                </div>
              )}
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Bill Discount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">₹</span>
                  <input
                    type="number"
                    name="discount_amount"
                    value={invoiceData.discount_amount}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Notes</label>
                <input
                  type="text"
                  name="notes"
                  value={invoiceData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-₹{totals.totalDiscountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>₹{totals.totalTaxAmount.toFixed(2)}</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>₹{totals.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-md font-semibold text-orange-600">
              <span>Outstanding Amount:</span>
              <span>₹{(() => {
                const selectedSupplier = suppliers.find(s => s.supplier_id.toString() === invoiceData.supplier_id.toString());
                console.log('🔍 Debug Supplier Outstanding Amount:', {
                  supplier_id: invoiceData.supplier_id,
                  selectedSupplier,
                  current_balance: selectedSupplier?.current_balance
                });
                return Math.abs(selectedSupplier?.current_balance || 0).toFixed(2);
              })()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Purchase Items</CardTitle>
            <div className="flex gap-3 items-center">
              <div className="relative min-w-[300px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search and add items..."
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  onBlur={() => setTimeout(() => setShowItemDropdown(false), 300)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                />
              
              {showItemDropdown && filteredItems.length > 0 && itemSearch && (
                <div className="absolute z-50 w-full mt-1 rounded-md max-h-60 overflow-auto" style={{
                  backgroundColor: '#ffffff', 
                  border: '2px solid #6b7280',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  marginTop: '4px'
                }}>
                  {filteredItems.slice(0, 10).map((item) => (
                    <div
                      key={item.item_id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur event
                        addItem(item);
                      }}
                      className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="font-bold text-fatima-green text-base">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="text-fatima-green">Stock: {item.current_stock || 0}</span>
                        <span className="mx-2">|</span>
                        <span className="text-green-600">Purchase Price: ₹{(item.purchase_price || item.sale_price || 0).toFixed(2)}</span>
                        {item.item_code && (
                          <>
                            <span className="mx-2">|</span>
                            <span className="text-gray-500">Code: {item.item_code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
              
              {/* Add Item Button */}
              <Button
                type="button"
                onClick={() => {
                  savePurchaseDataToStorage();
                  navigate('/items?add=true&from=purchase&return=purchase-invoice');
                }}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                title="Add New Item"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
              
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoiceItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items added. Search and select items to add to this purchase bill.
              {isEditing && (
                <div className="text-xs text-gray-500 mt-2">
                  Debug: {invoiceItems.length} items in state, isEditing: {isEditing.toString()}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="text-center min-w-[120px]">Current Stock</TableHead>
                    <TableHead className="text-center min-w-[100px]">Quantity</TableHead>
                    <TableHead className="text-right min-w-[120px]">Price</TableHead>
                    <TableHead className="text-right min-w-[120px]">Total</TableHead>
                    <TableHead className="text-center min-w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((item, index) => {
                    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                    return (
                      <TableRow key={index}>
                        <TableCell className="min-w-[200px]">
                          <div className="font-bold text-fatima-green text-sm">{item.product_name}</div>
                        </TableCell>
                        <TableCell className="text-center min-w-[120px]">
                          <span className="text-sm text-fatima-green bg-green-50 px-2 py-1 rounded">
                            {item.current_stock || 0} units
                          </span>
                        </TableCell>
                        <TableCell className="text-center min-w-[100px]">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                            className="w-20 px-2 py-1 border border-input rounded text-center focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                            min="0.001"
                            step="0.001"
                            placeholder="1"
                          />
                        </TableCell>
                        <TableCell className="text-right min-w-[120px]">
                          <div className="flex items-center justify-end">
                            <span className="text-sm mr-1 text-muted-foreground">₹</span>
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateInvoiceItem(index, 'rate', e.target.value)}
                              className="w-24 px-2 py-1 border border-input rounded text-right focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right min-w-[120px]">
                          <div className="font-semibold text-green-600">₹{total.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-center min-w-[80px]">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bank Account</label>
              <select
                value={paymentData.account_id}
                onChange={(e) => handlePaymentDataChange('account_id', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              >
                <option value="">Select Bank Account</option>
                {accounts.map(account => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name} - ₹{account.current_balance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount Paid</label>
              <input
                type="number"
                value={paymentData.amount_paid === 0 ? '' : paymentData.amount_paid}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    handlePaymentDataChange('amount_paid', 0);
                  } else {
                    handlePaymentDataChange('amount_paid', parseFloat(value) || 0);
                  }
                }}
                className="w-full px-3 py-2 border border-input rounded-md"
                step="0.01"
                placeholder="Enter amount paid"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => handlePaymentDataChange('payment_date', e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              />
            </div>
          </div>
          
          {/* Payment Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-3">Payment Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold">₹{totals.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-semibold text-green-600">₹{paymentData.amount_paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Balance Due:</span>
                <span className={`font-semibold ${(totals.totalAmount - paymentData.amount_paid) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{Math.max(0, totals.totalAmount - paymentData.amount_paid).toFixed(2)}
                </span>
              </div>
            </div>
            
            {paymentData.amount_paid > totals.totalAmount && (
              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                <strong>Note:</strong> Payment amount exceeds total bill amount by ₹{(paymentData.amount_paid - totals.totalAmount).toFixed(2)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseInvoice;