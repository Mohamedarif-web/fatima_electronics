import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GSTInvoice from '../../components/GSTInvoice';
import db from '../../utils/database';
import showToast from '../../utils/toast';
import '../../styles/invoice-print.css';

const GSTInvoicePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get invoice ID from URL params or location state
  const urlParams = new URLSearchParams(location.search);
  const invoiceId = urlParams.get('id') || location.state?.invoiceId;

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
    } else {
      // New invoice
      setLoading(false);
    }
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      
      // Load invoice details
      const invoice = await db.get(`
        SELECT 
          si.*,
          p.name as party_name,
          p.address as party_address,
          p.phone as party_phone,
          p.gst_number as party_gstin,
          p.current_balance as party_balance
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.invoice_id = ?
      `, [invoiceId]);

      if (!invoice) {
        showToast.error('Invoice not found!');
        navigate('/sales');
        return;
      }

      // Load invoice items with return quantities
      const items = await db.query(`
        SELECT 
          sii.*,
          i.product_name,
          i.hsn_code,
          i.gst_rate,
          COALESCE(sii.price_type, 'without_tax') as price_type,
          COALESCE(sii.return_quantity, 0) as return_quantity
        FROM sales_invoice_items sii
        LEFT JOIN items i ON sii.item_id = i.item_id
        WHERE sii.invoice_id = ?
        ORDER BY sii.item_id
      `, [invoiceId]);

      // Get real-time balance calculation (same as Party screen)
      const currentPartyBalance = await db.get(`
        SELECT 
          p.opening_balance + 
          COALESCE(sales.total_outstanding_sales, 0) - 
          COALESCE(payments_in.total_payments_received, 0) +
          COALESCE(purchases.total_outstanding_purchases, 0) -
          COALESCE(payments_out.total_payments_made, 0) as real_time_balance
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
        WHERE p.party_id = ?
      `, [invoice.party_id]);
      
      const realTimeBalance = parseFloat(currentPartyBalance?.real_time_balance) || 0;
      
      
      // Transform data for GST Invoice component
      const customerData = {
        name: invoice.party_name || invoice.name || 'Walk-in Customer',
        address: invoice.party_address || invoice.address || 'Address not provided',
        contact: invoice.party_phone || invoice.phone || 'N/A',
        gstin: invoice.party_gstin || invoice.gst_number || '',
        state: 'Tamil Nadu', // Default to Tamil Nadu since no state data in parties table
        stateCode: '33',
        current_balance: realTimeBalance  // Use real-time calculated balance (same as Party screen)
      };

      const transformedData = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        customer: customerData,
        items: items.map((item, index) => {
          const quantity = parseFloat(item.quantity) || 0;
          const rate = parseFloat(item.rate) || 0;
          const discountPercent = parseFloat(item.discount_percent) || 0;
          const discountAmount = parseFloat(item.discount_amount) || 0;
          const gstPercent = parseFloat(item.gst_rate) || 18;
          
          // Calculate values
          const gross = quantity * rate;
          const actualDiscountAmount = discountAmount || (gross * discountPercent) / 100;
          const taxableValue = gross - actualDiscountAmount;
          
          // Check if inter-state or intra-state (default to Tamil Nadu since no state data)
          const isInterState = false; // Default to intra-state (Tamil Nadu)
          
          // Use SAVED tax amounts from database (don't recalculate)
          const savedTaxAmount = parseFloat(item.tax_amount) || 0;
          const savedTaxRate = parseFloat(item.tax_rate) || 0;
          
          let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
          
          if (savedTaxAmount > 0) {
            if (isInterState) {
              igstAmount = savedTaxAmount;
            } else {
              cgstAmount = savedTaxAmount / 2;
              sgstAmount = savedTaxAmount / 2;
            }
          }
          
          const finalAmount = parseFloat(item.total_amount) || (taxableValue + savedTaxAmount);
          
          return {
            sno: index + 1,
            itemName: item.product_name || item.description || 'Item',
            hsnCode: item.hsn_code || '',
            quantity: quantity,
            unit: 'Nos',
            pricePerUnit: rate,
            price_type: item.price_type || 'without_tax', // Add price_type for calculation
            discountPercent: discountPercent,
            discountAmount: actualDiscountAmount,
            taxableValue: taxableValue,
            gstPercent: savedTaxRate,
            cgstAmount: cgstAmount,
            sgstAmount: sgstAmount,
            igstAmount: igstAmount,
            finalRate: rate - (actualDiscountAmount / quantity),
            amount: finalAmount,
            return_quantity: parseFloat(item.return_quantity) || 0  // Add return quantity
          };
        })
      };

      console.log('📋 Raw invoice data:', invoice);
      console.log('📦 Raw items data:', items);
      console.log('🎯 Transformed data:', transformedData);
      
      setInvoiceData(transformedData);
    } catch (error) {
      console.error('Error loading invoice data:', error);
      showToast.error('Error loading invoice: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async (invoiceData) => {
    try {
      // This would integrate with your existing sales invoice save logic
      console.log('Saving GST Invoice:', invoiceData);
      showToast.info('GST Invoice format ready for integration with sales system!');
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast.error('Error saving invoice: ' + error.message);
    }
  };

  const handleCancel = () => {
    navigate('/sales');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fatima-green mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      <div className="gst-invoice-container">
        <GSTInvoice 
          invoiceData={invoiceData}
          onSave={handleSaveInvoice}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default GSTInvoicePage;