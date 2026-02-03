import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Plus, Trash2, Save, FileText, Search, List, Calendar } from 'lucide-react';
import db from '../../utils/database';
import showToast from '../../utils/toast';

const SalesInvoice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  
  // Payment tracking
  const [paymentData, setPaymentData] = useState({
    account_id: '',
    amount_received: 0,
    payment_date: new Date().toISOString().split('T')[0]
  });
  
  // Invoice form state
  const [invoiceData, setInvoiceData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    party_id: '',
    payment_type: 'cash',
    account_id: '', // User must select account
    notes: '',
    discount_amount: 0
  });

  // Invoice items
  const [invoiceItems, setInvoiceItems] = useState([]);
  
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  
  // Item search for adding items
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  
  // Price type selection (dealer or customer)
  const [priceType, setPriceType] = useState('customer');

  // Update existing items when price type changes
  useEffect(() => {
    if (invoiceItems.length > 0 && items.length > 0) {
      setInvoiceItems(prevItems => 
        prevItems.map(invoiceItem => {
          // Find the full item details
          const fullItem = items.find(item => item.item_id === invoiceItem.item_id);
          if (!fullItem) return invoiceItem;
          
          // Get the appropriate price and price type based on selection
          const selectedPrice = priceType === 'dealer' 
            ? (fullItem.dealer_price || 0) 
            : (fullItem.customer_price || 0);
          const selectedPriceType = priceType === 'dealer' 
            ? (fullItem.dealer_price_type || 'without_tax') 
            : (fullItem.customer_price_type || 'without_tax');
          
          // Update the item with new price and price type
          return {
            ...invoiceItem,
            rate: selectedPrice,
            price_type: selectedPriceType
          };
        })
      );
    }
  }, [priceType, items]);

  useEffect(() => {
    loadCustomers();
    loadItems();
    loadAccounts();
    
    // Restore saved invoice data when coming back from navigation
    restoreInvoiceData();
  }, []);

  // Save current invoice data to localStorage
  const saveInvoiceDataToStorage = () => {
    const dataToSave = {
      invoiceData,
      invoiceItems,
      customerSearch,
      paymentData,
      timestamp: Date.now()
    };
    localStorage.setItem('tempInvoiceData', JSON.stringify(dataToSave));
    console.log('💾 Invoice data saved to localStorage');
  };

  // Restore invoice data from localStorage
  const restoreInvoiceData = () => {
    try {
      // Don't restore if we're editing or returning an invoice
      const editId = searchParams.get('edit');
      const returnId = searchParams.get('return');
      
      if (editId || returnId) {
        console.log('🚫 Skipping localStorage restore - editing/returning invoice');
        localStorage.removeItem('tempInvoiceData'); // Clear any old data
        return;
      }
      
      const savedData = localStorage.getItem('tempInvoiceData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Check if data is less than 1 hour old
        const hoursSinceCreation = (Date.now() - parsedData.timestamp) / (1000 * 60 * 60);
        
        if (hoursSinceCreation < 1) {
          setInvoiceData(parsedData.invoiceData || invoiceData);
          setInvoiceItems(parsedData.invoiceItems || []);
          setCustomerSearch(parsedData.customerSearch || '');
          setPaymentData(parsedData.paymentData || paymentData);
          
          console.log('🔄 Invoice data restored from localStorage');
          
          // Clear the saved data after restoration
          localStorage.removeItem('tempInvoiceData');
        }
      }
    } catch (error) {
      console.error('Error restoring invoice data:', error);
      localStorage.removeItem('tempInvoiceData');
    }
  };

  useEffect(() => {
    // Check if editing mode or return mode from URL params using React Router
    const editId = searchParams.get('edit');
    const returnId = searchParams.get('return');
    console.log('📋 URL Search params:', searchParams.toString());
    console.log('📋 Edit ID:', editId, 'Return ID:', returnId);
    console.log('📋 Customers loaded:', customers.length, 'Items loaded:', items.length);
    
    if (editId && customers.length > 0 && items.length > 0) {
      console.log('✅ Loading invoice for edit:', editId);
      loadInvoiceForEdit(editId);
    } else if (returnId && customers.length > 0 && items.length > 0) {
      console.log('✅ Loading invoice for return:', returnId);
      loadInvoiceForReturn(returnId);
    } else if (editId || returnId) {
      console.warn('⚠️ Cannot load invoice yet - waiting for data. Customers:', customers.length, 'Items:', items.length);
    }
  }, [customers, items, searchParams]); // Run when customers, items, or search params change

  const loadCustomers = async () => {
    try {
      console.log('🔍 Loading customers...');
      const data = await db.getParties('customer');
      console.log('📦 Raw customer data received:', data);
      console.log('📊 Number of customers:', data?.length);
      console.log('📋 First customer sample:', data?.[0]);
      
      // Filter out any invalid/empty customer records
      const validCustomers = (data || []).filter(customer => 
        customer && customer.party_id && customer.name
      );
      
      console.log('✅ Valid customers after filtering:', validCustomers.length);
      if (validCustomers.length !== data?.length) {
        console.warn('⚠️ Some invalid customer records were filtered out');
      }
      
      setCustomers(validCustomers);
    } catch (error) {
      console.error('❌ Error loading customers:', error);
      setCustomers([]);
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

  const loadAccounts = async () => {
    try {
      console.log('Loading bank accounts...');
      const data = await db.getAccounts();
      console.log('Bank accounts loaded:', data);
      setAccounts(data);
      
      // Remove the validation alerts - make bank accounts optional
      console.log(`Loaded ${data?.length || 0} bank accounts - bank selection is optional`);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
      console.log('Bank accounts not available - proceeding without bank selection');
    }
  };

  const loadInvoiceForReturn = async (invoiceId) => {
    try {
      setLoading(true);
      console.log('🔄 ========== LOADING INVOICE FOR RETURN ==========');
      console.log('🔄 Invoice ID:', invoiceId);
      console.log('🔄 Customers available:', customers.length);
      console.log('🔄 Items available:', items.length);
      
      // Get invoice data
      const invoice = await db.get('SELECT * FROM sales_invoices WHERE invoice_id = ?', [invoiceId]);
      console.log('📄 Invoice found for return:', invoice);
      
      if (invoice) {
        console.log('Setting up return mode for invoice:', invoice);
        setEditingInvoice({...invoice, isReturnMode: true}); // Flag to indicate return mode
        
        setInvoiceData({
          invoice_date: invoice.invoice_date,
          party_id: invoice.party_id,
          payment_type: invoice.payment_type,
          account_id: invoice.account_id || '',
          notes: `Return for Invoice: ${invoice.invoice_number}`,
          discount_amount: 0
        });
        
        // Find customer name for search field
        const customer = customers.find(c => c.party_id === invoice.party_id);
        console.log('🔍 Looking for customer with party_id:', invoice.party_id);
        console.log('📋 Available customers:', customers.length);
        console.log('✅ Customer found for return:', customer);
        if (customer) {
          setCustomerSearch(customer.name);
          console.log('✅ Customer search set to:', customer.name);
        } else {
          console.warn('⚠️ Customer not found! party_id:', invoice.party_id);
        }

        // Load invoice items for return
        const invoiceItems = await db.query('SELECT * FROM sales_invoice_items WHERE invoice_id = ?', [invoiceId]);
        console.log('📦 Invoice items from database:', invoiceItems.length, 'items');
        console.log('📦 First item sample:', invoiceItems[0]);
        
        if (invoiceItems.length > 0) {
          const itemsForReturn = await Promise.all(
            invoiceItems.map(async (item) => {
              const product = await db.getItemById(item.item_id);
              
              if (!product) {
                console.warn(`⚠️ Product not found for item_id: ${item.item_id}, skipping...`);
                return null;
              }
              
              const alreadyReturned = item.return_quantity || 0;
              const returnableQuantity = item.quantity - alreadyReturned;
              
              return {
                ...product,
                quantity: item.quantity,
                original_quantity: item.quantity,
                rate: item.rate,
                price_type: item.price_type || 'without_tax', // Load price_type from database
                discount_percent: item.discount_percent || 0,
                tax_rate: item.tax_rate || 0,
                current_stock: product.current_stock || 0,
                available_stock: product.current_stock || 0,
                return_quantity: alreadyReturned, // Show existing returned quantity
                max_returnable: item.quantity, // Maximum that can be returned (total quantity)
                already_returned: alreadyReturned, // Previously returned quantity
                remaining_returnable: returnableQuantity, // Remaining quantity that can be returned
                isReturnItem: true // Flag to indicate this is in return mode
              };
            })
          );
          
          // Filter out null items (deleted products)
          const validItems = itemsForReturn.filter(item => item !== null);
          console.log('✅ Valid items for return:', validItems.length);
          console.log('✅ Setting invoice items state...');
          setInvoiceItems(validItems);
          console.log('✅ Invoice items state set! Items:', validItems.length);
        } else {
          console.warn('⚠️ No invoice items found in database!');
        }
      } else {
        console.log('No invoice found for return ID:', invoiceId);
        showToast.error('Invoice not found');
      }
    } catch (error) {
      console.error('Error loading invoice for return:', error);
      showToast.error('Error loading invoice for return: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceForEdit = async (invoiceId) => {
    try {
      setLoading(true);
      console.log('Loading invoice for edit. Invoice ID:', invoiceId);
      
      // Try different methods to get invoice data
      let invoice = null;
      let invoiceItems = [];
      
      // Method 1: Try direct SQL query
      try {
        invoice = await db.get('SELECT * FROM sales_invoices WHERE invoice_id = ?', [invoiceId]);
        console.log('Invoice found:', invoice);
        
        if (invoice) {
          invoiceItems = await db.query('SELECT * FROM sales_invoice_items WHERE invoice_id = ?', [invoiceId]);
          console.log('Invoice items found:', invoiceItems);
        }
      } catch (error) {
        console.error('Error with direct SQL:', error);
        
        // Method 2: Try using existing db methods if they exist
        if (db.getInvoice) {
          invoice = await db.getInvoice(invoiceId);
        }
        if (db.getInvoiceItems) {
          invoiceItems = await db.getInvoiceItems(invoiceId);
        }
      }
      
      if (invoice) {
        console.log('Setting editing invoice:', invoice);
        setEditingInvoice(invoice);
        
        setInvoiceData({
          invoice_date: invoice.invoice_date,
          party_id: invoice.party_id,
          payment_type: invoice.payment_type,
          account_id: invoice.account_id || '', // Keep existing account, don't default to 1
          notes: invoice.notes || '',
          discount_amount: invoice.discount_amount || 0
        });
        
        // Find customer name for search field
        const customer = customers.find(c => c.party_id === invoice.party_id);
        console.log('Customer found:', customer);
        if (customer) {
          setCustomerSearch(customer.name);
        }

        // Load payment data for this invoice
        console.log('Loading payment data for invoice ID:', invoiceId);
        try {
          // Try multiple approaches to get payment data
          let paymentHistory = [];
          
          // Method 1: Try payment_transactions table with new schema
          try {
            paymentHistory = await db.query(`
              SELECT * FROM payment_transactions 
              WHERE reference_type = 'sales_invoice' AND reference_id = ? AND payment_type = 'payment_in'
              ORDER BY payment_date DESC
            `, [invoiceId]);
            console.log('Payment transactions found:', paymentHistory);
          } catch (e) {
            console.log('payment_transactions table not found, trying alternative...');
          }
          
          // Method 2: Check invoice paid_amount (fallback)
          if (paymentHistory.length === 0) {
            console.log('Using invoice data - paid_amount:', invoice.paid_amount, 'balance_amount:', invoice.balance_amount);
            const paidAmount = invoice.paid_amount || 0;
            if (paidAmount > 0) {
              setPaymentData(prev => ({
                ...prev,
                amount_received: paidAmount
              }));
              console.log('Payment data set from invoice paid_amount:', paidAmount);
            }
          }
          
          // Method 3: Use payment history if found
          if (paymentHistory.length > 0) {
            const latestPayment = paymentHistory[0];
            console.log('🔧 FIXING PAYMENT DATA LOADING:');
            console.log('  - Individual payment transaction amount:', latestPayment.amount);
            console.log('  - Invoice total paid_amount:', invoice.paid_amount);
            
            // Use invoice total paid amount, not individual transaction amount
            const totalPaidAmount = invoice.paid_amount || 0;
            
            setPaymentData({
              account_id: latestPayment.account_id || '',
              amount_received: totalPaidAmount, // Use total from invoice, not individual transaction
              payment_date: latestPayment.payment_date || new Date().toISOString().split('T')[0]
            });
            console.log('✅ Payment data set correctly with total paid amount:', totalPaidAmount);
          }
          
        } catch (error) {
          console.error('Error loading payment data:', error);
        }
        
        // Load invoice items with fresh product details directly from database
        if (invoiceItems.length > 0) {
          console.log('🔄 Loading fresh stock data directly from database...');
          const itemsWithDetails = await Promise.all(
            invoiceItems.map(async (item) => {
              // Get fresh product data directly from database (no cache)
              const product = await db.getItemById(item.item_id);
              console.log(`📦 ${product.product_name}: Fresh stock loaded ${product.current_stock}`);
              return {
                ...product,
                quantity: item.quantity,
                original_quantity: item.quantity, // Store original for return calculations
                rate: item.rate,
                price_type: item.price_type || 'without_tax', // Load price_type from database
                discount_percent: item.discount_percent || 0,
                tax_rate: item.tax_rate || product?.gst_rate || 0,
                current_stock: product.current_stock, // Show actual current stock (after this sale)
                available_stock: product.current_stock, // Available stock should be current stock
                actual_current_stock: product.current_stock, // Store the real current stock for display
                return_quantity: item.return_quantity || 0 // Load existing return quantity from database
              };
            })
          );
          
          console.log('✅ Items loaded with fresh stock data:', itemsWithDetails);
          setInvoiceItems(itemsWithDetails);
        }
      } else {
        console.log('No invoice found for ID:', invoiceId);
        showToast.error('Invoice not found');
      }
    } catch (error) {
      console.error('Error loading invoice for edit:', error);
      showToast.error('Error loading invoice for editing: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    console.log('📝 Input change event:', e.target.name, 'Loading state:', loading);
    const { name, value } = e.target;
    setInvoiceData(prev => ({ ...prev, [name]: value }));
  };

  const selectCustomer = (customer) => {
    console.log('🔍 Selecting customer:', customer);
    setInvoiceData(prev => {
      const updated = { ...prev, party_id: customer.party_id };
      console.log('📝 Invoice data updated:', updated);
      return updated;
    });
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
    
    // Force re-render by updating a dummy state
    console.log('✅ Customer selected successfully:', customer.name, 'ID:', customer.party_id);
  };

  // Handle keyboard navigation for customer search
  const handleCustomerSearchKeyDown = (e) => {
    if (!showCustomerDropdown || filteredCustomers.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCustomerIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedCustomerIndex(prev => 
          prev > 0 ? prev - 1 : filteredCustomers.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedCustomerIndex >= 0 && selectedCustomerIndex < filteredCustomers.length) {
          selectCustomer(filteredCustomers[selectedCustomerIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowCustomerDropdown(false);
        setSelectedCustomerIndex(-1);
        break;
    }
  };

  const addItem = (item) => {
    const existingItem = invoiceItems.find(i => i.item_id === item.item_id);
    
    if (existingItem) {
      // Increase quantity if item already exists
      setInvoiceItems(prev => 
        prev.map(i => 
          i.item_id === item.item_id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      // Add new item - use price based on selected price type
      const selectedPrice = priceType === 'dealer' ? (item.dealer_price || 0) : (item.customer_price || 0);
      const selectedPriceType = priceType === 'dealer' ? (item.dealer_price_type || 'without_tax') : (item.customer_price_type || 'without_tax');
      
      const newItem = {
        item_id: item.item_id,
        product_name: item.product_name,
        quantity: 1,
        rate: selectedPrice,
        price_type: selectedPriceType, // Store whether price includes tax
        discount_percent: 0,
        tax_rate: item.gst_rate,
        available_stock: item.current_stock
      };
      setInvoiceItems(prev => [...prev, newItem]);
    }
    
    setItemSearch('');
    setShowItemDropdown(false);
    setSelectedItemIndex(-1);
  };

  // Handle keyboard navigation for item search
  const handleItemSearchKeyDown = (e) => {
    const visibleItems = filteredItems.slice(0, 10);
    
    if (!showItemDropdown || visibleItems.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedItemIndex(prev => 
          prev < visibleItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedItemIndex(prev => 
          prev > 0 ? prev - 1 : visibleItems.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedItemIndex >= 0 && selectedItemIndex < visibleItems.length) {
          addItem(visibleItems[selectedItemIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowItemDropdown(false);
        setSelectedItemIndex(-1);
        break;
    }
  };

  // Function to refresh current stock for all items
  const refreshItemStocks = async () => {
    try {
      console.log('🔄 Refreshing item stocks from database...');
      const updatedItems = await Promise.all(
        invoiceItems.map(async (item) => {
          const currentItemData = await db.getItemById(item.item_id);
          console.log(`📦 ${item.product_name}: Stock updated ${item.current_stock || item.available_stock} → ${currentItemData.current_stock}`);
          return {
            ...item,
            current_stock: currentItemData.current_stock,
            available_stock: currentItemData.current_stock,
            // PRESERVE return_quantity during stock refresh
            return_quantity: item.return_quantity || 0
          };
        })
      );
      
      setInvoiceItems(updatedItems);
      console.log('✅ All item stocks refreshed - return quantities preserved');
    } catch (error) {
      console.error('❌ Error refreshing item stocks:', error);
    }
  };

  const updateInvoiceItem = (index, field, value) => {
    setInvoiceItems(prev => 
      prev.map((item, i) => {
        if (i === index) {
          if (field === 'quantity') {
            // Handle quantity changes - track stock adjustments needed
            const oldQty = item.quantity;
            // Allow empty string and preserve user input, only convert to number if valid
            let newQty = value;
            if (value !== '') {
              const parsedValue = parseFloat(value);
              if (!isNaN(parsedValue) && parsedValue >= 0) {
                newQty = parsedValue;
              } else {
                // Keep the previous value if input is invalid
                newQty = item.quantity;
              }
            }
            
            if (editingInvoice && oldQty !== newQty) {
              // Calculate stock adjustment needed
              const stockAdjustment = oldQty - newQty; // Positive = add to stock, Negative = remove from stock
              item.stockAdjustment = stockAdjustment;
            }
            
            return { ...item, quantity: newQty };
          } else if (field === 'return_quantity') {
            // Handle return quantity (only in edit mode)
            const returnQty = parseInt(value) || 0;
            const maxReturn = item.original_quantity || item.quantity;
            
            // No need to refresh stocks when return quantity changes - it doesn't affect current stock
            
            return { ...item, [field]: Math.min(returnQty, maxReturn) };
          } else {
            // For other fields, use float parsing
            return { ...item, [field]: parseFloat(value) || 0 };
          }
        }
        return item;
      })
    );
  };

  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const removeItem = (index) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateItemAmount = (item) => {
    const quantity = item.quantity === '' ? 0 : item.quantity;
    const returnQuantity = item.return_quantity || 0;
    const effectiveQuantity = Math.max(0, quantity - returnQuantity); // Subtract returns from quantity
    const baseAmount = effectiveQuantity * item.rate;
    const discountAmount = baseAmount * (item.discount_percent / 100);
    
    // Check if price includes tax or not
    const priceType = item.price_type || 'without_tax';
    let taxableAmount, taxAmount, totalAmount;
    
    if (priceType === 'with_tax') {
      // Price already includes tax - extract tax from the price
      const amountAfterDiscount = baseAmount - discountAmount;
      totalAmount = amountAfterDiscount;
      // Calculate tax component: total / (1 + tax_rate/100) gives taxable, rest is tax
      taxableAmount = totalAmount / (1 + (item.tax_rate / 100));
      taxAmount = totalAmount - taxableAmount;
    } else {
      // Price excludes tax - ADD GST to the discounted amount
      taxableAmount = baseAmount - discountAmount;
      taxAmount = taxableAmount * (item.tax_rate / 100);
      totalAmount = taxableAmount + taxAmount;
    }

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
    let returnSubtotal = 0;
    let returnDiscountAmount = 0;
    let returnTaxAmount = 0;
    let returnAmount = 0;

    invoiceItems.forEach(item => {
      const calc = calculateItemAmount(item);
      subtotal += calc.baseAmount;
      totalDiscountAmount += calc.discountAmount;
      totalTaxAmount += calc.taxAmount;
      totalAmount += calc.totalAmount;

      // Calculate return amounts
      if (item.return_quantity > 0) {
        const returnQuantity = item.return_quantity || 0;
        const returnBaseAmount = returnQuantity * item.rate;
        const returnDiscAmount = returnBaseAmount * (item.discount_percent / 100);
        
        // Check if price includes tax or not (same logic as main calculation)
        const priceType = item.price_type || 'without_tax';
        let returnTaxableAmount, returnTaxAmt, returnTotalAmount;
        
        if (priceType === 'with_tax') {
          // Price already includes tax - extract tax from the price
          const amountAfterDiscount = returnBaseAmount - returnDiscAmount;
          returnTotalAmount = amountAfterDiscount;
          // Calculate tax component: total / (1 + tax_rate/100) gives taxable, rest is tax
          returnTaxableAmount = returnTotalAmount / (1 + (item.tax_rate / 100));
          returnTaxAmt = returnTotalAmount - returnTaxableAmount;
        } else {
          // Price excludes tax - ADD GST to the discounted amount
          returnTaxableAmount = returnBaseAmount - returnDiscAmount;
          returnTaxAmt = returnTaxableAmount * (item.tax_rate / 100);
          returnTotalAmount = returnTaxableAmount + returnTaxAmt;
        }
        
        returnSubtotal += returnBaseAmount;
        returnDiscountAmount += returnDiscAmount;
        returnTaxAmount += returnTaxAmt;
        returnAmount += returnTotalAmount;
      }
    });

    // Apply invoice level discount
    const invoiceDiscountAmount = parseFloat(invoiceData.discount_amount) || 0;
    const finalTotal = totalAmount - invoiceDiscountAmount;
    const netAmount = finalTotal - returnAmount;

    return {
      subtotal,
      totalDiscountAmount: totalDiscountAmount + invoiceDiscountAmount,
      totalTaxAmount,
      totalAmount: finalTotal,
      returnSubtotal,
      returnDiscountAmount,
      returnTaxAmount,
      returnAmount,
      netAmount
    };
  };

  const validateInvoice = () => {
    if (!invoiceData.party_id) {
      showToast.warning('Please select a customer');
      return false;
    }

    if (invoiceItems.length === 0) {
      showToast.warning('Please add at least one item');
      return false;
    }

    // Removed all bank account validations - completely optional
    // Removed stock availability checks - allow overselling if needed

    return true;
  };

  const saveInvoice = async () => {
    if (!validateInvoice()) return;

    try {
      console.log('🔄 Setting loading to TRUE - form will be disabled');
      setLoading(true);
      
      // Get invoice number (use existing for edit, generate new for create)
      let invoiceNumber;
      if (editingInvoice) {
        invoiceNumber = editingInvoice.invoice_number;
      } else {
        // Generate unique invoice number
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        invoiceNumber = `SI${timestamp}${randomSuffix}`;
      }
      
      const totals = calculateInvoiceTotals();
      
      // Prepare invoice data
      const invoice = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceData.invoice_date,
        party_id: invoiceData.party_id,
        payment_type: invoiceData.payment_type,
        account_id: invoiceData.account_id || null,
        subtotal: totals.subtotal,
        discount_amount: totals.totalDiscountAmount,
        tax_amount: totals.totalTaxAmount,
        total_amount: totals.totalAmount,
        paid_amount: invoiceData.payment_type === 'cash' ? totals.totalAmount : 0,
        balance_amount: invoiceData.payment_type === 'cash' ? 0 : totals.totalAmount,
        notes: invoiceData.notes
      };

      // Prepare invoice items with calculations
      const itemsWithCalculations = invoiceItems.map(item => {
        const calc = calculateItemAmount(item);
        return {
          item_id: item.item_id,
          quantity: item.quantity,
          rate: item.rate,
          price_type: item.price_type || 'without_tax', // Include price_type
          discount_percent: item.discount_percent,
          discount_amount: calc.discountAmount,
          taxable_amount: calc.taxableAmount,
          tax_rate: item.tax_rate,
          tax_amount: calc.taxAmount,
          total_amount: calc.totalAmount
        };
      });

      // Calculate initial balance amounts
      const initialPaidAmount = paymentData.amount_received || 0;
      const initialBalanceAmount = Math.max(0, invoice.total_amount - initialPaidAmount);
      
      console.log(`Initial calculation: Total=${invoice.total_amount}, Paid=${initialPaidAmount}, Balance=${initialBalanceAmount}`);
      
      // Save invoice with transaction
      const operations = [];
      
      if (editingInvoice) {
        // Update existing invoice
        operations.push({
          sql: `UPDATE sales_invoices SET
            invoice_date = ?, party_id = ?, payment_type = ?, account_id = ?,
            subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?, 
            paid_amount = ?, balance_amount = ?, notes = ?
            WHERE invoice_id = ?`,
          params: [
            invoice.invoice_date, invoice.party_id, invoice.payment_type, 
            invoice.account_id, invoice.subtotal, invoice.discount_amount, 
            invoice.tax_amount, invoice.total_amount, initialPaidAmount, 
            initialBalanceAmount, invoice.notes, editingInvoice.invoice_id
          ]
        });
      } else {
        // Insert new invoice
        operations.push({
          sql: `INSERT INTO sales_invoices (
            invoice_number, invoice_date, party_id, payment_type, account_id,
            subtotal, discount_amount, tax_amount, total_amount, paid_amount, 
            balance_amount, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            invoice.invoice_number, invoice.invoice_date, invoice.party_id,
            invoice.payment_type, invoice.account_id, invoice.subtotal,
            invoice.discount_amount, invoice.tax_amount, invoice.total_amount,
            initialPaidAmount, initialBalanceAmount, invoice.notes
          ]
        });
      }

      await db.transaction(operations);
      
      // Get the invoice ID and save items
      let savedInvoice;
      let existingItemsMap = new Map(); // Initialize outside the if block
      
      if (editingInvoice) {
        savedInvoice = { invoice_id: editingInvoice.invoice_id };
        
        // Get existing items AND return quantities before deletion
        const existingItems = await db.query('SELECT item_id, quantity, return_quantity FROM sales_invoice_items WHERE invoice_id = ?', [editingInvoice.invoice_id]);
        
        // Store both existing quantities and return quantities for calculations
        const existingReturnsMap = new Map();
        existingItems.forEach(item => {
          existingItemsMap.set(item.item_id, item.quantity);
          existingReturnsMap.set(item.item_id, item.return_quantity || 0);
        });
        
        // Delete existing invoice items first
        await db.run('DELETE FROM sales_invoice_items WHERE invoice_id = ?', [editingInvoice.invoice_id]);
        
        // Store return data for later use
        savedInvoice.existingReturnsMap = existingReturnsMap;
      } else {
        savedInvoice = await db.get(
          'SELECT invoice_id FROM sales_invoices WHERE invoice_number = ?',
          [invoiceNumber]
        );
      }

      // Save invoice items and update stock
      for (const item of itemsWithCalculations) {
        // Get the corresponding UI item to access return_quantity
        const uiItem = invoiceItems.find(ui => ui.item_id === item.item_id);
        const returnQty = uiItem?.return_quantity || 0;
        
        await db.run(`
          INSERT INTO sales_invoice_items (
            invoice_id, item_id, quantity, rate, price_type, discount_percent, discount_amount,
            taxable_amount, tax_rate, tax_amount, total_amount, return_quantity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          savedInvoice.invoice_id, item.item_id, item.quantity, item.rate,
          item.price_type || 'without_tax', item.discount_percent, item.discount_amount, item.taxable_amount,
          item.tax_rate, item.tax_amount, item.total_amount, returnQty
        ]);

        // Update stock (only for new invoices OR calculate difference for edits)
        let stockChange = item.quantity; // For new invoices
        
        if (editingInvoice) {
          // For edits: calculate the difference between old and new quantities
          const oldQuantity = existingItemsMap.get(item.item_id) || 0;
          stockChange = item.quantity - oldQuantity; // Positive = more sold (reduce stock), Negative = less sold (add stock)
        }
        
        if (stockChange !== 0) {
          await db.run(`
            UPDATE items 
            SET current_stock = current_stock - ?
            WHERE item_id = ?
          `, [stockChange, item.item_id]);
          
          console.log(`📦 Stock adjusted for ${item.item_id}: ${stockChange > 0 ? 'reduced' : 'increased'} by ${Math.abs(stockChange)} units`);
        }

        // Record stock movement
        await db.run(`
          INSERT INTO stock_movements (
            item_id, movement_type, reference_type, reference_id, quantity, 
            rate, movement_date, description
          ) VALUES (?, 'out', 'sale', ?, ?, ?, ?, ?)
        `, [
          item.item_id, savedInvoice.invoice_id, item.quantity, item.rate,
          invoiceData.invoice_date, `Sale Invoice ${invoiceNumber}`
        ]);
      }

      // Update customer balance (for credit sales)
      if (invoice.payment_type === 'credit') {
        await db.run(`
          UPDATE parties 
          SET current_balance = current_balance + ?
          WHERE party_id = ?
        `, [invoice.total_amount, invoice.party_id]);
      }

      // Handle payment to bank account (ONLY for NEW invoices or when payment amount changes)
      if (paymentData.amount_received > 0 && paymentData.account_id) {
        let paymentAmountToProcess = paymentData.amount_received;
        
        // For editing: Calculate the difference and update bank balance accordingly
        if (editingInvoice) {
          const originalPaidAmount = parseFloat(editingInvoice.paid_amount) || 0;
          const newPaidAmount = parseFloat(paymentData.amount_received) || 0;
          paymentAmountToProcess = newPaidAmount - originalPaidAmount;
          
          console.log('💰 EDIT MODE - Payment difference calculation:', {
            originalPaid: originalPaidAmount,
            newPaid: newPaidAmount,
            difference: paymentAmountToProcess,
            accountId: paymentData.account_id
          });
          
          if (Math.abs(paymentAmountToProcess) < 0.01) {
            console.log('ℹ️ No payment difference - skipping bank balance update');
            paymentAmountToProcess = 0;
          }
        } else {
          console.log('💳 NEW INVOICE - Processing full payment amount:', paymentAmountToProcess);
        }
        
        // Only update if there's an amount to process
        if (Math.abs(paymentAmountToProcess) > 0.01) {
          // Update account balance with transaction history
          const balanceResult = await db.updateAccountBalance(
            paymentData.account_id,
            paymentAmountToProcess,
            {
              reference_type: editingInvoice ? 'sales_invoice_edit' : 'sales_invoice',
              reference_id: savedInvoice.invoice_id,
              transaction_date: paymentData.payment_date,
              description: editingInvoice 
                ? `Payment adjustment for invoice ${invoiceNumber} (${paymentAmountToProcess > 0 ? '+' : ''}₹${paymentAmountToProcess})`
                : `Payment received for invoice ${invoiceNumber}`
            }
          );

          console.log(`🏦 Account balance updated: ${balanceResult.balanceBefore} → ${balanceResult.balanceAfter}`);

          // Record payment transaction
          await db.recordPaymentTransaction({
            reference_type: editingInvoice ? 'sales_invoice_edit' : 'sales_invoice',
            reference_id: savedInvoice.invoice_id,
            reference_number: invoiceNumber,
            party_id: invoice.party_id,
            account_id: paymentData.account_id,
            payment_type: paymentAmountToProcess > 0 ? 'payment_in' : 'payment_out',
            amount: Math.abs(paymentAmountToProcess),
            payment_date: paymentData.payment_date,
            payment_method: 'bank_transfer',
            description: editingInvoice 
              ? `Payment adjustment for invoice ${invoiceNumber}: ${paymentAmountToProcess > 0 ? 'Additional' : 'Reduced'} ₹${Math.abs(paymentAmountToProcess)}`
              : `Payment received for sales invoice ${invoiceNumber}`,
            notes: invoice.notes
          });

          console.log(`✅ Payment transaction recorded: ₹${paymentAmountToProcess} to account ${paymentData.account_id}`);
        }

        // Update invoice balance amount
        const newBalanceAmount = Math.max(0, totals.totalAmount - paymentData.amount_received);
        const newPaidAmount = paymentData.amount_received;
        
        await db.run(`
          UPDATE sales_invoices 
          SET balance_amount = ?, paid_amount = ?
          WHERE invoice_id = ?
        `, [newBalanceAmount, newPaidAmount, savedInvoice.invoice_id]);

        console.log(`📊 Invoice updated: Total=₹${totals.totalAmount}, Paid=₹${newPaidAmount}, Balance=₹${newBalanceAmount}`);
        
        // Update both editingInvoice and paymentData state to reflect the new values for the UI
        if (editingInvoice) {
          setEditingInvoice(prev => ({
            ...prev,
            total_amount: totals.totalAmount,
            paid_amount: newPaidAmount,
            balance_amount: newBalanceAmount,
            updated_at: new Date().toISOString()
          }));
          
          // CRITICAL: Update paymentData state so the form shows current values
          console.log('🔧 DEBUGGING PAYMENT UPDATE:');
          console.log('  - Previous paymentData.amount_received:', paymentData.amount_received);
          console.log('  - New amount to set:', newPaidAmount);
          console.log('  - Original invoice paid_amount:', editingInvoice.paid_amount);
          
          setPaymentData(prev => {
            const updatedData = {
              ...prev,
              amount_received: newPaidAmount
            };
            console.log('  - Updated paymentData:', updatedData);
            return updatedData;
          });
          
          console.log('✅ UI state updated - form should now show current payment amount:', newPaidAmount);
        }
      }

      // Handle comprehensive adjustments when editing invoice
      if (editingInvoice) {
        const originalInvoice = editingInvoice;
        const originalTotalAmount = originalInvoice.total_amount;
        const newTotalAmount = totals.totalAmount;
        
        // 1. Handle stock adjustments for returns using saved return data
        for (const item of invoiceItems) {
          console.log(`ℹ️ Stock for ${item.product_name} already adjusted in main save loop`);
          
          // Handle returns - use the saved return data from before deletion
          if (item.return_quantity > 0) {
            const previousReturnQty = savedInvoice.existingReturnsMap?.get(item.item_id) || 0;
            const additionalReturnQty = item.return_quantity - previousReturnQty;
            
            console.log(`📊 Return calculation for ${item.product_name}:`, {
              previousReturn: previousReturnQty,
              newTotalReturn: item.return_quantity,
              additionalReturn: additionalReturnQty
            });
            
            // Only adjust stock for the ADDITIONAL return quantity
            if (additionalReturnQty > 0) {
              await db.run(`
                UPDATE items 
                SET current_stock = current_stock + ?
                WHERE item_id = ?
              `, [additionalReturnQty, item.item_id]);
              console.log(`✅ Added ${additionalReturnQty} units back to stock for ${item.product_name}`);
              
              // Record stock movement for the additional return only
              await db.run(`
                INSERT INTO stock_movements (
                  item_id, movement_type, reference_type, reference_id, quantity, 
                  rate, movement_date, description
                ) VALUES (?, 'in', 'return', ?, ?, ?, ?, ?)
              `, [
                item.item_id, editingInvoice.invoice_id, additionalReturnQty, item.rate,
                new Date().toISOString().split('T')[0], `Sales Return from Invoice ${editingInvoice.invoice_number} (+${additionalReturnQty} additional)`
              ]);
              console.log(`📝 Stock movement recorded for additional return: +${additionalReturnQty} units`);
            } else if (additionalReturnQty < 0) {
              // If return quantity was reduced, subtract from stock
              await db.run(`
                UPDATE items 
                SET current_stock = current_stock - ?
                WHERE item_id = ?
              `, [Math.abs(additionalReturnQty), item.item_id]);
              console.log(`✅ Reduced return by ${Math.abs(additionalReturnQty)} units, removed from stock for ${item.product_name}`);
            }
          }
        }

        // 2. Handle party balance adjustment for amount changes
        if (invoice.payment_type === 'credit' && originalTotalAmount !== newTotalAmount) {
          const balanceDifference = newTotalAmount - originalTotalAmount;
          await db.run(`
            UPDATE parties 
            SET current_balance = current_balance + ?
            WHERE party_id = ?
          `, [balanceDifference, invoice.party_id]);
          console.log(`Party balance adjusted by ₹${balanceDifference}`);
        }

        // 3. Payment changes are now handled in the main payment section above
        // This section is removed to prevent duplicate updates
      }

      // Refresh item stocks after any changes
      await refreshItemStocks();
      
      if (editingInvoice?.isReturnMode) {
        showToast.success(`Return processed successfully for Invoice ${invoiceNumber}!`);
        // Navigate to sales list after successful return processing
        navigate('/sales/list');
      } else if (editingInvoice) {
        showToast.success(`Invoice ${invoiceNumber} updated successfully!`);
        // Navigate to sales list after successful update
        navigate('/sales/list');
      } else {
        showToast.success(`Invoice ${invoiceNumber} saved successfully!`);
        // For new invoices, reset form to create another invoice
        resetForm();
      }
      
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast.error('Error saving invoice: ' + error.message);
    } finally {
      console.log('✅ Setting loading to FALSE - form should be enabled');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInvoiceData({
      invoice_date: new Date().toISOString().split('T')[0],
      party_id: '',
      payment_type: 'cash',
      account_id: '', // User must select account
      notes: '',
      discount_amount: 0
    });
    setInvoiceItems([]);
    setCustomerSearch('');
    setItemSearch('');
    setEditingInvoice(null);
    setShowItemDropdown(false);
    setShowCustomerDropdown(false);
    
    // Reset payment data
    setPaymentData({
      account_id: '',
      amount_received: 0,
      payment_date: new Date().toISOString().split('T')[0]
    });
    
    // Clear URL params to ensure we're in "new invoice" mode
    navigate('/sales/invoice', { replace: true });
    
    console.log('✅ Form reset complete - ready for new invoice');
  };

  const filteredCustomers = customers.filter(customer => {
    // Safety check for customer data
    if (!customer || !customer.name) {
      console.warn('⚠️ Invalid customer in filter:', customer);
      return false;
    }
    return customer.name.toLowerCase().includes(customerSearch.toLowerCase());
  });

  // Debug filtered customers
  if (showCustomerDropdown && customerSearch) {
    console.log('🔎 Filtering customers with search:', customerSearch);
    console.log('📋 Total customers:', customers.length);
    console.log('✅ Filtered customers:', filteredCustomers.length);
    if (filteredCustomers.length > 0) {
      console.log('👤 First filtered customer:', filteredCustomers[0]);
    }
  }

  const filteredItems = items.filter(item =>
    item.product_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const getItemsByCategory = () => {
    if (selectedCategory === 'all') {
      return items;
    }
    return items.filter(item => 
      item.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
    return ['all', ...categories];
  };

  const totals = calculateInvoiceTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {editingInvoice?.isReturnMode ? 'Process Return' : 
             editingInvoice ? 'Edit Sales Invoice' : 'Sales Invoice'}
          </h1>
          {editingInvoice && (
            <p className="text-sm text-muted-foreground mt-1">
              {editingInvoice.isReturnMode ? 
               `Processing return for: ${editingInvoice.invoice_number}` :
               `Editing: ${editingInvoice.invoice_number}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/sales')}>
            <List className="w-4 h-4 mr-2" />
            Sales List
          </Button>
          <Button variant="outline" onClick={resetForm}>
            <FileText className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
          <Button 
            onClick={saveInvoice} 
            disabled={loading}
            className="bg-fatima-green hover:bg-fatima-green/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {editingInvoice?.isReturnMode ? 'Process Return' :
             editingInvoice ? 'Update Invoice' : 'Save Invoice'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Header */}
        <div className="modern-card lg:col-span-2">
          <div className="modern-card-header">
            <h3>Invoice Details</h3>
          </div>
          <div className="modern-card-content space-y-6" style={{ overflow: 'visible' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Invoice Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="invoice_date"
                    value={invoiceData.invoice_date}
                    onChange={handleInputChange}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-fatima-green focus:ring-2 focus:ring-green-200 text-gray-900 font-medium cursor-pointer"
                    style={{
                      backgroundColor: '#ffffff',
                      minHeight: '44px',
                      fontSize: '16px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Type</label>
                <select
                  name="payment_type"
                  value={invoiceData.payment_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Invoice Discount</label>
                <input
                  type="number"
                  name="discount_amount"
                  value={invoiceData.discount_amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Customer Selection */}
            <div className="relative" style={{ zIndex: 10 }}>
              <label className="block text-sm font-medium mb-1">Customer *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search and select customer..."
                  value={customerSearch}
                  onChange={(e) => {
                    const searchValue = e.target.value;
                    console.log('🔍 Customer search changed:', searchValue);
                    setCustomerSearch(searchValue);
                    setShowCustomerDropdown(true);
                    setSelectedCustomerIndex(-1);
                    console.log('📋 Available customers:', customers.length);
                    console.log('🎯 Should show dropdown:', true);
                  }}
                  onFocus={() => {
                    console.log('👆 Customer input focused');
                    console.log('📊 Customers available:', customers.length);
                    setShowCustomerDropdown(true);
                  }}
                  onKeyDown={handleCustomerSearchKeyDown}
                  onBlur={() => {
                    // Delay hiding dropdown to allow click selection
                    setTimeout(() => setShowCustomerDropdown(false), 200);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>
              
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div 
                  className="absolute w-full mt-1 rounded-md max-h-60 overflow-auto" 
                  style={{
                    backgroundColor: '#ffffff', 
                    border: '2px solid #6b7280',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    marginTop: '4px',
                    zIndex: 9999
                  }}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking dropdown
                    e.preventDefault();
                    console.log('🖱️ Dropdown clicked');
                  }}
                >
                  {filteredCustomers.map((customer, index) => {
                    console.log(`📋 Rendering customer ${index}:`, customer.name, customer.party_id);
                    return (
                      <div
                        key={customer.party_id}
                        onClick={() => {
                          console.log('👆 Customer clicked:', customer.name, customer.party_id);
                          selectCustomer(customer);
                        }}
                        onMouseDown={(e) => {
                          // Prevent blur before click fires
                          e.preventDefault();
                        }}
                        className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                          index === selectedCustomerIndex 
                            ? 'bg-fatima-green text-white' 
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className={`text-sm ${
                          index === selectedCustomerIndex 
                            ? 'text-green-100' 
                            : 'text-muted-foreground'
                        }`}>
                          {customer.phone}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Customer Details Display */}
              {invoiceData.party_id && (
                (() => {
                  const selectedCustomer = customers.find(c => c.party_id.toString() === invoiceData.party_id.toString());
                  if (selectedCustomer) {
                    return (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Customer Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Name:</span>
                            <p className="text-gray-900">{selectedCustomer.name}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Phone:</span>
                            <p className="text-gray-900">{selectedCustomer.phone || 'N/A'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-700">Address:</span>
                            <p className="text-gray-900">{selectedCustomer.address || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Outstanding Amount:</span>
                            <p className={`font-bold ${selectedCustomer.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ₹{Math.abs(selectedCustomer.current_balance || 0).toLocaleString('en-IN')}
                              <span className="text-xs ml-1">
                                {selectedCustomer.current_balance >= 0 ? '(Credit)' : '(Debit)'}
                              </span>
                            </p>
                          </div>
                          {selectedCustomer.gst_number && (
                            <div>
                              <span className="font-medium text-gray-700">GST Number:</span>
                              <p className="text-gray-900">{selectedCustomer.gst_number}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={invoiceData.notes}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="modern-card">
          <div className="modern-card-header">
            <h3>Invoice Summary</h3>
          </div>
          <div className="modern-card-content space-y-4">
            <div className="flex justify-between text-black">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Discount:</span>
              <span>-₹{totals.totalDiscountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-black">
              <span>Tax:</span>
              <span>₹{totals.totalTaxAmount.toFixed(2)}</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg font-bold text-black">
              <span>Total:</span>
              <span>₹{totals.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-md font-semibold text-black">
              <span>Outstanding Amount:</span>
              <span>₹{(() => {
                const selectedCustomer = customers.find(c => c.party_id.toString() === invoiceData.party_id.toString());
                console.log('🔍 Debug Outstanding Amount:', {
                  party_id: invoiceData.party_id,
                  selectedCustomer,
                  current_balance: selectedCustomer?.current_balance
                });
                return Math.abs(selectedCustomer?.current_balance || 0).toFixed(2);
              })()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoice Items</CardTitle>
            <div className="flex gap-3 items-center">
              {/* Price Type Selection - Hide in return mode */}
              {!editingInvoice?.isReturnMode && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">Price Type:</label>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value)}
                    className="px-3 py-2 rounded-md border border-gray-300 bg-white font-medium"
                    style={{border: '1px solid #333'}}
                  >
                    <option value="customer">Customer</option>
                    <option value="dealer">Dealer</option>
                  </select>
                </div>
              )}
              
              {/* Search Input and Add Item Button */}
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search and add items..."
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemDropdown(true);
                      setSelectedItemIndex(-1);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    onKeyDown={handleItemSearchKeyDown}
                    className="pl-10 pr-4 py-2 rounded-md w-64"
                    style={{border: '1px solid #333'}}
                  />
                  
                  {showItemDropdown && filteredItems.length > 0 && itemSearch && (
                    <div className="absolute z-50 w-full mt-1 rounded-md max-h-60 overflow-auto" style={{
                      backgroundColor: '#ffffff', 
                      border: '2px solid #6b7280',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                      marginTop: '4px'
                    }}>
                      {filteredItems.slice(0, 10).map((item, index) => (
                        <div
                          key={item.item_id}
                          onClick={() => addItem(item)}
                          className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            index === selectedItemIndex 
                              ? 'bg-green-100 border-green-300' 
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Stock: {item.current_stock} | Dealer: ₹{item.dealer_price || 0} | Customer: ₹{item.customer_price || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <Button
                  type="button"
                  onClick={() => {
                    saveInvoiceDataToStorage();
                    navigate('/items?add=true&return=sales-invoice');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                  title="Add New Item"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoiceItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items added. Search and select items to add to this invoice.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden border rounded-lg">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white min-w-[250px] border-r">Item</TableHead>
                    <TableHead className="min-w-[80px] text-center">Qty</TableHead>
                    {editingInvoice && (
                      <TableHead className="min-w-[80px] text-center">Return</TableHead>
                    )}
                    <TableHead className="min-w-[120px] text-center">Rate</TableHead>
                    <TableHead className="min-w-[80px] text-center">Disc%</TableHead>
                    <TableHead className="min-w-[100px] text-center">Tax Status</TableHead>
                    <TableHead className="min-w-[140px] text-right">Amount</TableHead>
                    <TableHead className="min-w-[80px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {invoiceItems.map((item, index) => {
                  const calc = calculateItemAmount(item);
                  return (
                    <TableRow key={index}>
                      <TableCell className="sticky left-0 bg-white border-r">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Stock: {item.current_stock || item.available_stock || 0}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateInvoiceItem(index, 'quantity', value);
                          }}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value) <= 0) {
                              updateInvoiceItem(index, 'quantity', '1');
                            }
                          }}
                          className="w-16 px-2 py-1 rounded text-center font-medium"
                          style={{border: '1px solid #333', backgroundColor: '#fff'}}
                          min="1"
                          step="1"
                          placeholder="1"
                        />
                      </TableCell>
                      
                      {editingInvoice && (
                        <TableCell className="text-center">
                          <input
                            type="number"
                            value={item.return_quantity || 0}
                            onChange={(e) => updateInvoiceItem(index, 'return_quantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-16 px-2 py-1 rounded text-center font-medium border-red-300"
                            style={{border: '1px solid #ef4444', backgroundColor: '#fef2f2'}}
                            min="0"
                            max={item.original_quantity || item.quantity}
                            step="1"
                            placeholder="0"
                            title={`Return quantity (max: ${item.original_quantity || item.quantity})`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <input
                          type="number"
                          value={item.rate === 0 ? '' : item.rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateInvoiceItem(index, 'rate', value);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-20 px-2 py-1 rounded text-center font-medium"
                          style={{border: '1px solid #333', backgroundColor: '#fff'}}
                          step="0.01"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="number"
                          value={item.discount_percent}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateInvoiceItem(index, 'discount_percent', value);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-16 px-2 py-1 rounded text-center"
                          style={{border: '1px solid #333', backgroundColor: '#fff'}}
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-center">
                          <span className="text-green-600 font-medium text-sm">{item.tax_rate}%</span>
                          <br />
                          {item.price_type === 'with_tax' ? (
                            <span className="text-xs text-orange-600">Inclusive</span>
                          ) : (
                            <span className="text-xs text-green-600">Applied</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div>
                            <div className="font-medium">₹{calc.totalAmount.toFixed(2)}</div>
                            {/* Return indicator in amount column */}
                            {item.return_quantity > 0 && (
                              <div className="text-xs text-orange-600 font-medium mt-1">
                                -{item.return_quantity} returned
                              </div>
                            )}
                          </div>
                          {calc.discountAmount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              -₹{calc.discountAmount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
              <label className="block text-sm font-medium mb-1">Amount Received</label>
              <input
                type="number"
                value={paymentData.amount_received === 0 ? '' : paymentData.amount_received}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    handlePaymentDataChange('amount_received', 0);
                  } else {
                    handlePaymentDataChange('amount_received', parseFloat(value) || 0);
                  }
                }}
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholder="0.00"
                step="0.01"
                max={totals.totalAmount}
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
          {paymentData.amount_received > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">
                  Payment of ₹{paymentData.amount_received.toFixed(2)} will be added to selected bank account
                </span>
                <span className="text-sm font-medium text-green-800">
                  Balance: ₹{(totals.totalAmount - paymentData.amount_received).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default SalesInvoice;