import React, { useState, useRef } from 'react';
import { Printer, Download, Plus, Trash2 } from 'lucide-react';

const GSTInvoice = ({ invoiceData = null, onSave, onCancel }) => {
  const printRef = useRef();
  
  // Company Information
  const [companyInfo] = useState({
    name: "FATHIMA ELECTRICALS",
    address: "56/69, Shanthi Shopping Complex",
    city: "Sankarankovil, Tamil Nadu",
    phone: "63695 10345",
    email: "sajienterprises79@gmail.com",
    gstin: "33EQQPM0894E1ZJ",
    state: "Tamil Nadu",
    stateCode: "33"
  });

  // Invoice State - Initialize with invoiceData if provided
  const [invoice, setInvoice] = useState({
    invoiceNumber: invoiceData?.invoice_number || 'INV-001',
    invoiceDate: invoiceData?.invoice_date || new Date().toISOString().split('T')[0],
    placeOfSupply: 'Tamil Nadu',
    customer: invoiceData?.customer || {
      name: 'Sample Customer',
      address: '123 Main Street\nCity Name - 600001',
      contact: '9876543210',
      gstin: '33XXXXX1234X1X1',
      state: 'Tamil Nadu',
      stateCode: '33'
    },
    items: invoiceData?.items || [{
      sno: 1,
      itemName: 'Sample Product',
      hsnCode: '1234',
      quantity: 2,
      unit: 'Nos',
      pricePerUnit: 1000,
      discountPercent: 10,
      discountAmount: 200,
      taxableValue: 1800,
      gstPercent: 18,
      cgstAmount: 162,
      sgstAmount: 162,
      igstAmount: 0,
      finalRate: 900,
      amount: 2124
    }]
  });

  // Update invoice when invoiceData prop changes
  React.useEffect(() => {
    if (invoiceData) {
      console.log('🔄 Updating invoice with new data:', invoiceData);
      setInvoice({
        invoiceNumber: invoiceData.invoice_number || '',
        invoiceDate: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        placeOfSupply: 'Tamil Nadu',
        customer: invoiceData.customer || {
          name: '',
          address: '',
          contact: '',
          gstin: '',
          state: 'Tamil Nadu',
          stateCode: '33'
        },
        items: invoiceData.items || []
      });
    }
  }, [invoiceData]);

  // Add new item row
  const addItem = () => {
    const newItem = {
      sno: invoice.items.length + 1,
      itemName: '',
      hsnCode: '',
      quantity: 1,
      unit: 'Nos',
      pricePerUnit: 0,
      discountPercent: 0,
      discountAmount: 0,
      taxableValue: 0,
      gstPercent: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      finalRate: 0,
      amount: 0
    };
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove item row
  const removeItem = (index) => {
    if (invoice.items.length > 1) {
      setInvoice(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index).map((item, i) => ({
          ...item,
          sno: i + 1
        }))
      }));
    }
  };

  // Calculate item values
  const calculateItem = (index, field, value) => {
    const items = [...invoice.items];
    const item = { ...items[index] };
    
    item[field] = value;
    
    // Calculate discount amount
    if (field === 'discountPercent' || field === 'pricePerUnit' || field === 'quantity') {
      const gross = item.pricePerUnit * item.quantity;
      item.discountAmount = (gross * item.discountPercent) / 100;
    }
    
    if (field === 'discountAmount') {
      const gross = item.pricePerUnit * item.quantity;
      item.discountPercent = gross > 0 ? (item.discountAmount * 100) / gross : 0;
    }
    
    // Calculate taxable value
    const gross = item.pricePerUnit * item.quantity;
    item.taxableValue = gross - item.discountAmount;
    
    // Check if inter-state or intra-state
    const isInterState = invoice.customer.stateCode !== companyInfo.stateCode;
    
    if (isInterState) {
      // IGST
      item.igstAmount = (item.taxableValue * item.gstPercent) / 100;
      item.cgstAmount = 0;
      item.sgstAmount = 0;
    } else {
      // CGST + SGST
      const gstRate = item.gstPercent / 2;
      item.cgstAmount = (item.taxableValue * gstRate) / 100;
      item.sgstAmount = (item.taxableValue * gstRate) / 100;
      item.igstAmount = 0;
    }
    
    // Final rate and amount
    item.finalRate = item.pricePerUnit - (item.discountAmount / item.quantity);
    item.amount = item.taxableValue + item.cgstAmount + item.sgstAmount + item.igstAmount;
    
    items[index] = item;
    setInvoice(prev => ({ ...prev, items }));
  };

  // Calculate totals with return handling - Fixed calculation
  const calculateTotals = () => {
    const totals = invoice.items.reduce((acc, item) => {
      // Use the correct item amount (which should be based on quantity - return_quantity)
      const effectiveQuantity = item.quantity - (item.return_quantity || 0);
      const effectiveAmount = effectiveQuantity * item.pricePerUnit;
      const returnAmount = (item.return_quantity || 0) * item.pricePerUnit;
      
      return {
        quantity: acc.quantity + item.quantity,
        subTotal: acc.subTotal + (item.pricePerUnit * item.quantity),
        discount: acc.discount + item.discountAmount,
        taxableValue: acc.taxableValue + item.taxableValue,
        cgst: acc.cgst + item.cgstAmount,
        sgst: acc.sgst + item.sgstAmount,
        igst: acc.igst + item.igstAmount,
        grandTotal: acc.grandTotal + (item.pricePerUnit * item.quantity), // Original total amount
        // Return calculations - simplified
        returnQuantity: acc.returnQuantity + (item.return_quantity || 0),
        returnTotal: acc.returnTotal + returnAmount
      };
    }, {
      quantity: 0,
      subTotal: 0,
      discount: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      grandTotal: 0,
      returnQuantity: 0,
      returnTotal: 0
    });

    // Calculate net total: Original Total - Return Amount
    totals.netGrandTotal = totals.grandTotal - totals.returnTotal;

    return totals;
  };

  const totals = calculateTotals();

  // Convert number to words (Indian format)
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convertHundreds = (n) => {
      let result = '';
      if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        result += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      } else if (n >= 10) {
        result += teens[n - 10] + ' ';
        return result;
      }
      if (n > 0) {
        result += ones[n] + ' ';
      }
      return result;
    };
    
    const crores = Math.floor(num / 10000000);
    const lakhs = Math.floor((num % 10000000) / 100000);
    const thousands = Math.floor((num % 100000) / 1000);
    const hundreds = num % 1000;
    
    let result = '';
    if (crores) result += convertHundreds(crores) + 'Crore ';
    if (lakhs) result += convertHundreds(lakhs) + 'Lakh ';
    if (thousands) result += convertHundreds(thousands) + 'Thousand ';
    if (hundreds) result += convertHundreds(hundreds);
    
    return result.trim() + ' Rupees Only';
  };

  // Print function - Only print invoice content
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      alert('Please allow popups to enable printing');
      return;
    }

    // Get the invoice content HTML
    const invoiceHTML = printContent.innerHTML;
    
    // Write the HTML content to the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GST Invoice - ${invoice.invoiceNumber}</title>
          <style>
            body {
              margin: 0;
              padding: 10mm;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
            }
            
            .no-print {
              display: none !important;
            }
            
            table {
              border-collapse: collapse !important;
            }
            
            table td, table th {
              border: 1px solid #9ca3af !important;
            }
            
            @page {
              size: A4;
              margin: 10mm;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 5mm;
              }
            }
            
            /* Include Tailwind-like styles for proper rendering */
            .text-2xl { font-size: 1.5rem; line-height: 2rem; }
            .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
            .text-base { font-size: 1rem; line-height: 1.5rem; }
            .text-xs { font-size: 0.75rem; line-height: 1rem; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .border { border-width: 1px; }
            .border-2 { border-width: 2px; }
            .border-black { border-color: #000000; }
            .border-gray-400 { border-color: #9ca3af; }
            .border-gray-300 { border-color: #d1d5db; }
            .border-b { border-bottom-width: 1px; }
            .border-b-2 { border-bottom-width: 2px; }
            .border-t { border-top-width: 1px; }
            .border-t-2 { border-top-width: 2px; }
            .bg-gray-200 { background-color: #e5e7eb; }
            .bg-blue-50 { background-color: #eff6ff; }
            .bg-blue-100 { background-color: #dbeafe; }
            .bg-red-50 { background-color: #fef2f2; }
            .bg-red-100 { background-color: #fee2e2; }
            .bg-green-200 { background-color: #bbf7d0; }
            .bg-orange-100 { background-color: #fed7aa; }
            .text-gray-900 { color: #111827; }
            .text-gray-700 { color: #374151; }
            .text-gray-600 { color: #4b5563; }
            .text-black { color: #000000; }
            .text-blue-800 { color: #1e40af; }
            .text-red-800 { color: #991b1b; }
            .p-2 { padding: 0.5rem; }
            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-3 { padding-top: 0.75rem; }
            .pb-1 { padding-bottom: 0.25rem; }
            .pb-3 { padding-bottom: 0.75rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-6 { margin-top: 1.5rem; }
            .mt-12 { margin-top: 3rem; }
            .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .col-span-2 { grid-column: span 2 / span 2; }
            .gap-4 { gap: 1rem; }
            .gap-6 { gap: 1.5rem; }
            .w-full { width: 100%; }
            .flex { display: flex; }
            .items-start { align-items: flex-start; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .justify-between { justify-content: space-between; }
            .inline-block { display: inline-block; }
            .whitespace-pre-line { white-space: pre-line; }
            .italic { font-style: italic; }
          </style>
        </head>
        <body>
          ${invoiceHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  };

  // Export PDF function using html2canvas and jsPDF
  const handleExportPDF = async () => {
    const element = printRef.current;
    
    if (!element) {
      console.error('Print element not found');
      return;
    }

    try {
      console.log('📄 Starting PDF generation...');
      console.log('📊 Current invoice data:', invoice);
      console.log('📊 Current items count:', invoice.items.length);

      // Load libraries from CDN
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      // Check if libraries are already loaded
      if (!window.html2canvas) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      }
      
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }

      const html2canvas = window.html2canvas;
      const { jsPDF } = window.jspdf;

      // Hide action buttons
      const noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => el.style.display = 'none');

      // Force a small delay to ensure DOM is updated with latest state
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('📸 Capturing invoice as image...');

      // Get the actual dimensions of the element
      const originalWidth = element.offsetWidth;
      const originalHeight = element.offsetHeight;

      // Capture the element as canvas with better settings
      const canvas = await html2canvas(element, {
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: originalWidth,
        height: originalHeight,
        windowWidth: originalWidth,
        windowHeight: originalHeight,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        imageTimeout: 0,
        allowTaint: false
      });

      // Restore hidden elements
      noPrintElements.forEach(el => el.style.display = '');

      console.log('📝 Creating PDF document...');

      // Calculate PDF dimensions to maintain aspect ratio
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add margins
      const margin = 5;
      const pdfWidth = imgWidth - (2 * margin);
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = margin;
      let page = 1;

      // Convert canvas to high-quality image
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Add first page
      pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - 2 * margin);

      // Add new pages if content exceeds one page
      while (heightLeft > 0) {
        position = -(pageHeight * page) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - 2 * margin);
        page++;
      }

      // Save the PDF
      pdf.save(`GST-Invoice-${invoice.invoiceNumber || 'draft'}.pdf`);
      console.log('✅ PDF generated successfully');

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      alert('PDF generation failed. Please try again or use Print option.\n\nError: ' + error.message);
      
      // Restore hidden elements even on error
      const noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => el.style.display = '');
    }
  };


  return (
    <div className="max-w-full mx-auto bg-gray-100 p-4">
      {/* Action Buttons - Only show on screen, not in print */}
      <div className="no-print flex justify-between items-center mb-4 p-4 bg-white rounded shadow">
        <div className="flex gap-2 relative">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Back to Sales
            </button>
          )}
        </div>
      </div>

      {/* Invoice Content - Printable */}
      <div 
        ref={printRef} 
        className="print-content bg-white border shadow-lg" 
        style={{ 
          fontFamily: 'Arial, sans-serif', 
          width: '210mm', 
          minHeight: '297mm', 
          margin: '0 auto',
          padding: '15mm',
          boxSizing: 'border-box'
        }}
      >
        {/* Invoice Header */}
        <div className="border-b-2 border-black pb-3 mb-3">
          <div className="grid grid-cols-3 gap-4">
            {/* Company Info */}
            <div className="col-span-2">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{companyInfo.name}</h1>
              <div className="text-xs text-gray-700 space-y-0.5">
                <p>{companyInfo.address}</p>
                <p>{companyInfo.city}</p>
                <p>Phone: {companyInfo.phone}</p>
                <p>Email: {companyInfo.email}</p>
                <p>GSTIN: {companyInfo.gstin}</p>
                <p>State: {companyInfo.state} | Code: {companyInfo.stateCode}</p>
              </div>
            </div>
            
            {/* Tax Invoice Title */}
            <div className="text-center flex items-start justify-center">
              <h2 className="text-xl font-bold border-2 border-black px-4 py-2 inline-block">
                TAX INVOICE
              </h2>
            </div>
          </div>
        </div>

        {/* Bill To and Invoice Details */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          {/* Bill To Section */}
          <div className="border border-gray-400">
            <div className="bg-gray-200 px-3 py-1.5 font-semibold text-xs">BILL TO</div>
            <div className="p-2 space-y-1">
              <div className="font-medium text-gray-900 text-xs">{invoice.customer.name || 'Walk-in Customer'}</div>
              <div className="text-xs text-gray-700 whitespace-pre-line">
                {invoice.customer.address || 'No address provided'}
              </div>
              <div className="text-xs text-black">
                <strong>Contact:</strong> {invoice.customer.contact || 'N/A'}
              </div>
              <div className="text-xs text-black">
                <strong>GSTIN:</strong> {invoice.customer.gstin || 'Not provided'}
              </div>
              <div className="text-xs text-black">
                <strong>State:</strong> {invoice.customer.state} | <strong>Code:</strong> {invoice.customer.stateCode}
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="border border-gray-400">
            <div className="bg-gray-200 px-3 py-1.5 font-semibold text-xs">INVOICE DETAILS</div>
            <div className="p-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-black">Invoice Number:</span>
                <span className="text-xs font-medium text-black">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-black">Invoice Date:</span>
                <span className="text-xs font-medium text-black">
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-black">Place of Supply:</span>
                <span className="text-xs font-medium text-black">{invoice.placeOfSupply}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-4">
          <table className="w-full border-collapse border border-gray-400 text-[10px]">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-2 py-1 w-[5%]">S.No</th>
                <th className="border px-2 py-1 w-[30%] text-left">Item Name</th>
                <th className="border px-2 py-1 w-[10%]">HSN / SAC</th>
                <th className="border px-2 py-1 w-[8%]">Qty</th>
                <th className="border px-2 py-1 w-[8%]">Return</th>
                <th className="border px-2 py-1 w-[7%]">Unit</th>
                <th className="border px-2 py-1 w-[12%] text-right">Rate</th>
                <th className="border px-2 py-1 w-[20%] text-right">Amount</th>
              </tr>
            </thead>

            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td className="border px-2 py-1 text-center text-black">{item.sno}</td>
                  <td className="border px-2 py-1 text-black">{item.itemName}</td>
                  <td className="border px-2 py-1 text-center text-black">{item.hsnCode}</td>
                  <td className="border px-2 py-1 text-center text-black">{item.quantity}</td>
                  <td className="border px-2 py-1 text-center text-black">
                    {(item.return_quantity || 0) > 0 ? item.return_quantity : '-'}
                  </td>
                  <td className="border px-2 py-1 text-center text-black">{item.unit}</td>
                  <td className="border px-2 py-1 text-right text-black">₹ {item.pricePerUnit.toFixed(2)}</td>
                  <td className="border px-2 py-1 text-right font-semibold text-black">₹ {item.amount.toFixed(2)}</td>
                </tr>
              ))}
              
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold">Amount in Words:</p>
            <p className="text-xs font-medium border-b border-gray-300 pb-1">
              {numberToWords(Math.round(totals.grandTotal))}
            </p>
          </div>
          
          <div className="border border-gray-400">
            <table className="w-full text-xs">
              <tbody>
                {/* Sales Summary */}
                <tr className="bg-blue-50">
                  <td className="border-b border-gray-300 px-2 py-1.5 font-semibold text-blue-800" colSpan="2">SALES SUMMARY</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-black">Total Quantity:</td>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-right font-medium text-black">{totals.quantity}</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-black">Sub Total:</td>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-right text-black">₹{totals.subTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-black">Total Discount:</td>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-right text-black">₹{totals.discount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-black">Taxable Value:</td>
                  <td className="border-b border-gray-300 px-2 py-1.5 text-right text-black">₹{totals.taxableValue.toFixed(2)}</td>
                </tr>
                {totals.cgst > 0 && (
                  <>
                    <tr>
                      <td className="border-b border-gray-300 px-2 py-1.5">CGST:</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 text-right">₹{totals.cgst.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="border-b border-gray-300 px-2 py-1.5">SGST:</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 text-right">₹{totals.sgst.toFixed(2)}</td>
                    </tr>
                  </>
                )}
                {totals.igst > 0 && (
                  <tr>
                    <td className="border-b border-gray-300 px-2 py-1.5">IGST:</td>
                    <td className="border-b border-gray-300 px-2 py-1.5 text-right">₹{totals.igst.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="bg-blue-100">
                  <td className="px-2 py-2 font-bold text-black">Sales Total:</td>
                  <td className="px-2 py-2 text-right font-bold text-black">₹{totals.grandTotal.toFixed(2)}</td>
                </tr>

                {/* Returns Summary (only show if there are returns) - Simplified */}
                {totals.returnTotal > 0 && (
                  <>
                    <tr className="bg-red-50">
                      <td className="border-b border-gray-300 px-2 py-1.5 font-semibold text-red-800" colSpan="2">RETURNS</td>
                    </tr>
                    <tr>
                      <td className="border-b border-gray-300 px-2 py-1.5 text-black">Return Quantity:</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 text-right text-black">{totals.returnQuantity}</td>
                    </tr>
                    <tr className="bg-red-100">
                      <td className="px-2 py-2 font-bold text-black">Return Amount:</td>
                      <td className="px-2 py-2 text-right font-bold text-black">-₹{totals.returnTotal.toFixed(2)}</td>
                    </tr>
                  </>
                )}

                {/* Final Net Amount */}
                <tr className="bg-green-200">
                  <td className="px-2 py-2 font-bold text-black text-base">NET AMOUNT:</td>
                  <td className="px-2 py-2 text-right font-bold text-black text-base">₹{totals.netGrandTotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-orange-100">
                  <td className="px-2 py-2 font-bold text-black">Outstanding Amount:</td>
                  <td className="px-2 py-2 text-right font-bold text-black">₹{(invoiceData?.customer?.current_balance || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-6 mt-6 pt-3 border-t-2 border-gray-400">
          <div className="space-y-1">
            <p className="text-xs font-semibold">Declaration:</p>
            <p className="text-xs text-gray-700">
              We declare that this invoice shows the actual price of the goods described and that 
              all particulars are true and correct.
            </p>
            <br />
            <p className="text-xs italic text-gray-600">This is a computer generated invoice</p>
          </div>
          
          <div className="text-center">
            <div className="mt-12 border-t border-gray-400 pt-2">
              <p className="text-xs font-medium">Authorized Signature</p>
              <p className="text-xs text-gray-600">{companyInfo.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          .no-print {
            display: none !important;
          }
          
          .print-content {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 10mm !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        }
        
        .print-content {
          box-sizing: border-box;
        }
        
        .print-content * {
          box-sizing: border-box;
        }

        .print-content table {
          border-collapse: collapse !important;
        }

        .print-content table td,
        .print-content table th {
          border: 1px solid #9ca3af !important;
        }
      `}</style>
    </div>
  );
};

export default GSTInvoice;