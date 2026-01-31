import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { FileText, Download, Calendar, TrendingUp, BarChart3, Users, Package, ArrowLeft, Filter } from 'lucide-react';
import db from '../../utils/database';
import showToast from '../../utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BusinessReports = () => {
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [reportSummary, setReportSummary] = useState({});
  const [dateFilter, setDateFilter] = useState({
    from: '2025-12-01', // Set to start of December to catch existing data
    to: new Date().toISOString().split('T')[0]
  });
  
  // Party filter state
  const [partyFilter, setPartyFilter] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [parties, setParties] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Load parties for filtering
  const loadParties = async () => {
    try {
      const partiesData = await db.getParties('customer');
      setParties(partiesData);
      console.log('📋 Loaded parties for filtering:', partiesData.length);
    } catch (error) {
      console.error('Error loading parties:', error);
    }
  };

  // Load parties on component mount
  React.useEffect(() => {
    loadParties();
  }, []);

  // Close party dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPartyDropdown && !event.target.closest('.party-dropdown-container')) {
        setShowPartyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPartyDropdown]);

  // Report generation functions
  const generateSalesReport = async () => {
    setLoading(true);
    try {
      // Build query with party filter
      let query = `
        SELECT 
          s.invoice_number,
          s.invoice_date,
          p.name as party_name,
          s.total_amount,
          s.discount_amount,
          (s.total_amount - s.discount_amount) as net_amount,
          s.paid_amount,
          s.balance_amount,
          s.notes
        FROM sales_invoices s
        LEFT JOIN parties p ON s.party_id = p.party_id
        WHERE s.is_deleted = 0 
        AND DATE(s.invoice_date) >= DATE(?) 
        AND DATE(s.invoice_date) <= DATE(?)
      `;
      
      const queryParams = [dateFilter.from, dateFilter.to];
      
      // Add party filter if selected
      if (partyFilter && partyFilter !== 'all') {
        query += ' AND s.party_id = ?';
        queryParams.push(partyFilter);
      }
      
      query += ' ORDER BY s.invoice_date DESC, s.invoice_number DESC';
      
      console.log('🔍 Sales Report Query:', query);
      console.log('🔍 Query Params:', queryParams);
      
      const salesData = await db.query(query, queryParams);

      // Calculate summary
      const totalSales = salesData.reduce((sum, item) => sum + (item.net_amount || 0), 0);
      const totalQuantity = salesData.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalDiscount = salesData.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const uniqueInvoices = new Set(salesData.map(item => item.invoice_number)).size;

      setReportData(salesData);
      setReportSummary({
        totalSales,
        totalQuantity,
        totalDiscount,
        uniqueInvoices,
        averageValue: totalSales / (uniqueInvoices || 1)
      });
    } catch (error) {
      console.error('Error generating sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseReport = async () => {
    setLoading(true);
    try {
      const purchaseData = await db.query(`
        SELECT 
          p.bill_number as invoice_number,
          p.bill_date as invoice_date,
          s.name as supplier_name,
          p.total_amount,
          p.discount_amount,
          (p.total_amount - p.discount_amount) as net_amount,
          p.paid_amount,
          p.balance_amount,
          p.notes
        FROM purchase_invoices p
        LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
        WHERE p.is_deleted = 0 
        AND DATE(p.bill_date) >= DATE(?) 
        AND DATE(p.bill_date) <= DATE(?)
        ORDER BY p.bill_date DESC, p.bill_number DESC
      `, [dateFilter.from, dateFilter.to]);

      // Calculate summary
      const totalPurchases = purchaseData.reduce((sum, item) => sum + (item.net_amount || 0), 0);
      const totalQuantity = purchaseData.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalDiscount = purchaseData.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const uniqueInvoices = new Set(purchaseData.map(item => item.invoice_number)).size;

      setReportData(purchaseData);
      setReportSummary({
        totalPurchases,
        totalQuantity,
        totalDiscount,
        uniqueInvoices,
        averageValue: totalPurchases / (uniqueInvoices || 1)
      });
    } catch (error) {
      console.error('Error generating purchase report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDayBook = async () => {
    setLoading(true);
    try {
      const transactions = await db.query(`
        SELECT 
          'Sale' as type,
          invoice_number as reference,
          invoice_date as date,
          (total_amount - discount_amount) as amount,
          'Credit' as flow
        FROM sales_invoices 
        WHERE is_deleted = 0 
        AND DATE(invoice_date) >= DATE(?) 
        AND DATE(invoice_date) <= DATE(?)
        
        UNION ALL
        
        SELECT 
          'Purchase' as type,
          bill_number as reference,
          bill_date as date,
          (total_amount - discount_amount) as amount,
          'Debit' as flow
        FROM purchase_invoices 
        WHERE is_deleted = 0 
        AND DATE(bill_date) >= DATE(?) 
        AND DATE(bill_date) <= DATE(?)
        
        UNION ALL
        
        SELECT 
          'Expense' as type,
          expense_number as reference,
          expense_date as date,
          amount as amount,
          'Debit' as flow
        FROM expenses 
        WHERE is_deleted = 0 
        AND DATE(expense_date) >= DATE(?) 
        AND DATE(expense_date) <= DATE(?)
        
        ORDER BY date DESC, reference DESC
      `, [
        dateFilter.from, dateFilter.to,
        dateFilter.from, dateFilter.to, 
        dateFilter.from, dateFilter.to
      ]);

      // Calculate summary
      const totalCredit = transactions.filter(t => t.flow === 'Credit').reduce((sum, t) => sum + t.amount, 0);
      const totalDebit = transactions.filter(t => t.flow === 'Debit').reduce((sum, t) => sum + t.amount, 0);
      const netFlow = totalCredit - totalDebit;

      setReportData(transactions);
      setReportSummary({
        totalCredit,
        totalDebit,
        netFlow,
        transactionCount: transactions.length
      });
    } catch (error) {
      console.error('Error generating day book:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle report selection
  const handleReportSelect = async (report) => {
    setCurrentReport(report);
    setReportData([]);
    setReportSummary({});
    
    switch (report.id) {
      case 'sales-report':
        await generateSalesReport();
        break;
      case 'purchase-report':
        await generatePurchaseReport();
        break;
      case 'day-book':
        await generateDayBook();
        break;
      case 'all-transactions':
        await generateAllTransactions();
        break;
      case 'cash-flow':
        await generateCashFlow();
        break;
      case 'profit-loss':
        await generateProfitLoss();
        break;
      case 'party-statement':
        await generatePartyStatement();
        break;
      case 'all-parties':
        await generateAllParties();
        break;
      case 'party-profit-loss':
        await generatePartyProfitLoss();
        break;
      case 'stock-summary':
        await generateStockSummary();
        break;
      case 'item-profit-loss':
        await generateItemProfitLoss();
        break;
      case 'expense-report':
        await generateExpenseReport();
        break;
      case 'expense-category-wise':
        await generateExpenseCategoryWise();
        break;
      case 'full-statement':
        await generateFullStatement();
        break;
      default:
        // For reports not yet implemented, show placeholder
        break;
    }
  };

  // Apply date filter
  const applyDateFilter = async () => {
    if (currentReport) {
      await handleReportSelect(currentReport);
    }
  };

  // Filter parties based on search
  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(partySearch.toLowerCase())
  );

  // Handle party selection
  const handlePartySelect = (partyId, partyName) => {
    setPartyFilter(partyId);
    setPartySearch(partyName);
    setShowPartyDropdown(false);
    if (currentReport && (currentReport.id === 'sales-report' || currentReport.id === 'full-statement')) {
      handleReportSelect(currentReport);
    }
  };

  // Number formatting function
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    
    // Return full number with proper formatting
    return number.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Export Functions
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Simple Black and White Header
    doc.setDrawColor(0, 0, 0); // Black border
    doc.setLineWidth(0.5);
    doc.line(14, 20, pageWidth - 14, 20); // Top line
    
    // Company Name - Simple and Clean
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0); // Black text
    doc.text('FATIMA ELECTRONICS', pageWidth / 2, 15, { align: 'center' });
    
    // Report Title - Clean and Simple
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(currentReport.title, pageWidth / 2, 30, { align: 'center' });
    
    // Date Information - Simple formatting
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Period: ${new Date(dateFilter.from).toLocaleDateString('en-IN')} to ${new Date(dateFilter.to).toLocaleDateString('en-IN')}`, pageWidth / 2, 40, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`, pageWidth / 2, 45, { align: 'center' });
    
    // Bottom line
    doc.line(14, 50, pageWidth - 14, 50);
    
    // Add summary section - Simple Black and White
    let yPosition = 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Black text
    doc.setDrawColor(0, 0, 0); // Black lines
    doc.setLineWidth(0.5);
    doc.line(14, yPosition - 2, pageWidth - 14, yPosition - 2); // Top line
    doc.text('REPORT SUMMARY', 14, yPosition + 6);
    doc.line(14, yPosition + 10, pageWidth - 14, yPosition + 10); // Bottom line
    yPosition += 18;
    
    // Add summary data in professional format
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    if (currentReport.id === 'sales-report') {
      doc.text(`• Total Sales Revenue: Rs ${formatNumber(reportSummary.totalSales)}`, 16, yPosition);
      doc.text(`• Number of Invoices: ${reportSummary.uniqueInvoices || '0'}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Average Invoice Value: Rs ${formatNumber(reportSummary.averageValue)}`, 16, yPosition);
      doc.text(`• Total Discount Given: Rs ${formatNumber(reportSummary.totalDiscount)}`, 110, yPosition);
      
    } else if (currentReport.id === 'purchase-report') {
      doc.text(`• Total Purchase Cost: Rs ${formatNumber(reportSummary.totalPurchases)}`, 16, yPosition);
      doc.text(`• Number of Bills: ${reportSummary.uniqueInvoices || '0'}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Average Bill Value: Rs ${formatNumber(reportSummary.averageValue)}`, 16, yPosition);
      doc.text(`• Total Discount Received: Rs ${formatNumber(reportSummary.totalDiscount)}`, 110, yPosition);
      
    } else if (currentReport.id === 'day-book') {
      doc.text(`• Total Credit (Inflow): Rs ${formatNumber(reportSummary.totalCredit)}`, 16, yPosition);
      doc.text(`• Total Debit (Outflow): Rs ${formatNumber(reportSummary.totalDebit)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Net Cash Flow: Rs ${formatNumber(reportSummary.netFlow)}`, 16, yPosition);
      doc.text(`• Total Transactions: ${reportSummary.transactionCount || '0'}`, 110, yPosition);
      
    } else if (currentReport.id === 'all-transactions') {
      doc.text(`• Total Credit (Inflow): Rs ${formatNumber(reportSummary.totalCredit)}`, 16, yPosition);
      doc.text(`• Total Debit (Outflow): Rs ${formatNumber(reportSummary.totalDebit)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Net Cash Flow: Rs ${formatNumber(reportSummary.netFlow)}`, 16, yPosition);
      doc.text(`• Total Transactions: ${reportSummary.transactionCount || '0'}`, 110, yPosition);
      
    } else if (currentReport.id === 'cash-flow') {
      doc.text(`• Total Opening Balance: Rs ${formatNumber(reportSummary.totalOpening)}`, 16, yPosition);
      doc.text(`• Total Current Balance: Rs ${formatNumber(reportSummary.totalCurrent)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Net Change: Rs ${formatNumber(reportSummary.netChange)}`, 16, yPosition);
      doc.text(`• Number of Accounts: ${reportSummary.accountCount || '0'}`, 110, yPosition);
      
    } else if (currentReport.id === 'profit-loss') {
      doc.text(`• Total Sales Revenue: Rs ${formatNumber(reportSummary.totalSales)}`, 16, yPosition);
      doc.text(`• Total Purchase Cost: Rs ${formatNumber(reportSummary.totalPurchases)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Gross Profit: Rs ${formatNumber(reportSummary.grossProfit)}`, 16, yPosition);
      doc.text(`• Net Profit: Rs ${formatNumber(reportSummary.netProfit)}`, 110, yPosition);
      
    } else if (currentReport.id === 'party-statement') {
      doc.text(`• Total Active Parties: ${reportSummary.totalParties || '0'}`, 16, yPosition);
      doc.text(`• Total Outstanding: Rs ${formatNumber(reportSummary.totalOutstanding)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Total Sales: Rs ${formatNumber(reportSummary.totalSales)}`, 16, yPosition);
      doc.text(`• Average Balance: Rs ${formatNumber(reportSummary.averageBalance)}`, 110, yPosition);
      
    } else if (currentReport.id === 'party-profit-loss') {
      doc.text(`• Active Parties in Period: ${reportSummary.totalParties || '0'}`, 16, yPosition);
      doc.text(`• Total Net Sales: Rs ${formatNumber(reportSummary.totalNetSales)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Total Invoices: ${reportSummary.totalInvoices || '0'}`, 16, yPosition);
      doc.text(`• Average Party Value: Rs ${formatNumber(reportSummary.averagePartyValue)}`, 110, yPosition);
      
    } else if (currentReport.id === 'all-parties') {
      doc.text(`• Total Parties: ${reportSummary.totalParties || '0'}`, 16, yPosition);
      doc.text(`• Lifetime Sales: Rs ${formatNumber(reportSummary.totalLifetimeSales)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Total Outstanding: Rs ${formatNumber(reportSummary.totalOutstanding)}`, 16, yPosition);
      doc.text(`• Avg. Lifetime Value: Rs ${formatNumber(reportSummary.averageLifetimeValue)}`, 110, yPosition);
      
    } else if (currentReport.id === 'stock-summary') {
      doc.text(`• Total Items in Stock: ${reportSummary.totalItems || '0'}`, 16, yPosition);
      doc.text(`• Total Stock Value: Rs ${formatNumber(reportSummary.totalStockValue)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Low Stock Items: ${reportSummary.lowStockItems || '0'}`, 16, yPosition);
      doc.text(`• Average Item Value: Rs ${formatNumber(reportSummary.averageStockValue)}`, 110, yPosition);
      
    } else if (currentReport.id === 'item-profit-loss') {
      doc.text(`• Total Items: ${reportSummary.totalItems || '0'}`, 16, yPosition);
      doc.text(`• Potential Profit: Rs ${formatNumber(reportSummary.totalPotentialProfit)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Average Margin: ${reportSummary.avgProfitMargin?.toFixed(1) || '0'}%`, 16, yPosition);
      doc.text(`• Cost Value: Rs ${formatNumber(reportSummary.totalStockValueCost)}`, 110, yPosition);
      
    } else if (currentReport.id === 'expense-report') {
      doc.text(`• Total Expenses: Rs ${formatNumber(reportSummary.totalExpenses)}`, 16, yPosition);
      doc.text(`• Total Entries: ${reportSummary.expenseCount || '0'}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Categories Used: ${reportSummary.uniqueCategories || '0'}`, 16, yPosition);
      doc.text(`• Average Expense: Rs ${formatNumber(reportSummary.averageExpense)}`, 110, yPosition);
      
    } else if (currentReport.id === 'full-statement') {
      doc.text(`• Total Credit (Inflow): Rs ${formatNumber(reportSummary.total_credit)}`, 16, yPosition);
      doc.text(`• Total Debit (Outflow): Rs ${formatNumber(reportSummary.total_debit)}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Net Balance: Rs ${formatNumber(reportSummary.net_balance)}`, 16, yPosition);
      doc.text(`• Total Transactions: ${reportSummary.total_transactions || '0'}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Period: ${reportSummary.date_range || 'Not specified'}`, 16, yPosition);
      doc.text(`• Party Filter: ${reportSummary.party_filter || 'All Parties'}`, 110, yPosition);
      
    } else if (currentReport.id === 'expense-category-wise') {
      doc.text(`• Total Expenses: Rs ${formatNumber(reportSummary.totalExpenses)}`, 16, yPosition);
      doc.text(`• Active Categories: ${reportSummary.totalCategories || '0'}`, 110, yPosition);
      yPosition += 8;
      doc.text(`• Highest Category: ${reportSummary.highestCategory || 'N/A'}`, 16, yPosition);
      doc.text(`• Avg. per Category: Rs ${formatNumber(reportSummary.averageCategorySpend)}`, 110, yPosition);
    }
    
    yPosition += 15;
    
    // Prepare table data
    const tableData = getTableDataForExport();
    const columns = getTableColumnsForExport();
    
    // Add table - Simple Black and White
    autoTable(doc, {
      startY: yPosition,
      head: [columns],
      body: tableData,
      styles: { 
        fontSize: 8,
        cellPadding: 3,
        lineColor: [0, 0, 0], // Black lines
        lineWidth: 0.1,
        textColor: [0, 0, 0] // Black text
      },
      headStyles: { 
        fillColor: [255, 255, 255], // White background
        textColor: [0, 0, 0], // Black text
        fontStyle: 'bold',
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.5
      },
      alternateRowStyles: { 
        fillColor: [255, 255, 255] // White background for all rows
      },
      margin: { top: 60 },
      theme: 'grid'
    });
    
    // Save the PDF
    const fileName = `${currentReport.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const exportToExcel = () => {
    // Prepare data for Excel
    const tableData = getTableDataForExport();
    const columns = getTableColumnsForExport();
    
    // Create worksheet data
    const wsData = [
      [`Fatima Electronics - ${currentReport.title}`],
      [`Date Range: ${dateFilter.from} to ${dateFilter.to}`],
      [`Generated on: ${new Date().toLocaleString()}`],
      [], // Empty row
      ['Summary:'],
    ];
    
    // Add summary data for all reports
    if (currentReport.id === 'sales-report') {
      wsData.push(
        [`Total Sales: Rs ${formatNumber(reportSummary.totalSales)}`, `Invoices: ${reportSummary.uniqueInvoices || '0'}`],
        [`Average Value: Rs ${formatNumber(reportSummary.averageValue)}`, `Total Discount: Rs ${formatNumber(reportSummary.totalDiscount)}`]
      );
    } else if (currentReport.id === 'purchase-report') {
      wsData.push(
        [`Total Purchases: Rs ${formatNumber(reportSummary.totalPurchases)}`, `Bills: ${reportSummary.uniqueInvoices || '0'}`],
        [`Average Value: Rs ${formatNumber(reportSummary.averageValue)}`, `Total Discount: Rs ${formatNumber(reportSummary.totalDiscount)}`]
      );
    } else if (currentReport.id === 'day-book' || currentReport.id === 'all-transactions') {
      wsData.push(
        [`Total Credit: Rs ${formatNumber(reportSummary.totalCredit)}`, `Total Debit: Rs ${formatNumber(reportSummary.totalDebit)}`],
        [`Net Flow: Rs ${formatNumber(reportSummary.netFlow)}`, `Transactions: ${reportSummary.transactionCount || '0'}`]
      );
    } else if (currentReport.id === 'cash-flow') {
      wsData.push(
        [`Opening Balance: Rs ${formatNumber(reportSummary.totalOpening)}`, `Current Balance: Rs ${formatNumber(reportSummary.totalCurrent)}`],
        [`Net Change: Rs ${formatNumber(reportSummary.netChange)}`, `Accounts: ${reportSummary.accountCount || '0'}`]
      );
    } else if (currentReport.id === 'profit-loss') {
      wsData.push(
        [`Total Sales: Rs ${formatNumber(reportSummary.totalSales)}`, `Total Purchases: Rs ${formatNumber(reportSummary.totalPurchases)}`],
        [`Gross Profit: Rs ${formatNumber(reportSummary.grossProfit)}`, `Net Profit: Rs ${formatNumber(reportSummary.netProfit)}`]
      );
    } else if (currentReport.id === 'party-statement') {
      wsData.push(
        [`Active Parties: ${reportSummary.totalParties || '0'}`, `Total Outstanding: Rs ${formatNumber(reportSummary.totalOutstanding)}`],
        [`Total Sales: Rs ${formatNumber(reportSummary.totalSales)}`, `Average Balance: Rs ${formatNumber(reportSummary.averageBalance)}`]
      );
    } else if (currentReport.id === 'party-profit-loss') {
      wsData.push(
        [`Active Parties: ${reportSummary.totalParties || '0'}`, `Total Net Sales: Rs ${formatNumber(reportSummary.totalNetSales)}`],
        [`Total Invoices: ${reportSummary.totalInvoices || '0'}`, `Average Party Value: Rs ${formatNumber(reportSummary.averagePartyValue)}`]
      );
    } else if (currentReport.id === 'all-parties') {
      wsData.push(
        [`Total Parties: ${reportSummary.totalParties || '0'}`, `Lifetime Sales: Rs ${formatNumber(reportSummary.totalLifetimeSales)}`],
        [`Total Outstanding: Rs ${formatNumber(reportSummary.totalOutstanding)}`, `Avg. Lifetime Value: Rs ${formatNumber(reportSummary.averageLifetimeValue)}`]
      );
    } else if (currentReport.id === 'stock-summary') {
      wsData.push(
        [`Total Items: ${reportSummary.totalItems || '0'}`, `Total Stock Value: Rs ${formatNumber(reportSummary.totalStockValue)}`],
        [`Low Stock Items: ${reportSummary.lowStockItems || '0'}`, `Average Item Value: Rs ${formatNumber(reportSummary.averageStockValue)}`]
      );
    } else if (currentReport.id === 'item-profit-loss') {
      wsData.push(
        [`Total Items: ${reportSummary.totalItems || '0'}`, `Potential Profit: Rs ${formatNumber(reportSummary.totalPotentialProfit)}`],
        [`Average Margin: ${reportSummary.avgProfitMargin?.toFixed(1) || '0'}%`, `Cost Value: Rs ${formatNumber(reportSummary.totalStockValueCost)}`]
      );
    } else if (currentReport.id === 'expense-report') {
      wsData.push(
        [`Total Expenses: Rs ${formatNumber(reportSummary.totalExpenses)}`, `Total Entries: ${reportSummary.expenseCount || '0'}`],
        [`Categories Used: ${reportSummary.uniqueCategories || '0'}`, `Average Expense: Rs ${formatNumber(reportSummary.averageExpense)}`]
      );
    } else if (currentReport.id === 'expense-category-wise') {
      wsData.push(
        [`Total Expenses: Rs ${formatNumber(reportSummary.totalExpenses)}`, `Active Categories: ${reportSummary.totalCategories || '0'}`],
        [`Highest Category: ${reportSummary.highestCategory || 'N/A'}`, `Avg. per Category: Rs ${formatNumber(reportSummary.averageCategorySpend)}`]
      );
    }
    
    wsData.push([], columns); // Empty row + headers
    wsData.push(...tableData); // Data rows
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, currentReport.title);
    
    // Save the Excel file
    const fileName = `${currentReport.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getTableColumnsForExport = () => {
    switch (currentReport?.id) {
      case 'sales-report':
        return ['S.No', 'Invoice No.', 'Date', 'Party', 'Total Amount', 'Discount', 'Net Amount', 'Paid', 'Balance'];
      case 'purchase-report':
        return ['S.No', 'Bill No.', 'Date', 'Supplier', 'Total Amount', 'Discount', 'Net Amount', 'Paid', 'Balance'];
      case 'day-book':
      case 'all-transactions':
        return ['S.No', 'Date', 'Type', 'Reference', 'Debit', 'Credit'];
      case 'cash-flow':
        return ['S.No', 'Account', 'Type', 'Opening', 'Current', 'Change'];
      case 'profit-loss':
        return ['S.No', 'Item', 'Amount'];
      case 'party-statement':
        return ['S.No', 'Party Name', 'Opening Balance', 'Current Balance', 'Total Sales', 'Invoices'];
      case 'party-profit-loss':
        return ['S.No', 'Party Name', 'Invoices', 'Total Sales', 'Discounts', 'Net Sales', 'Avg. Invoice', 'Outstanding'];
      case 'all-parties':
        return ['S.No', 'Party Name', 'Phone', 'Current Balance', 'Lifetime Sales', 'Total Invoices'];
      case 'stock-summary':
        return ['S.No', 'Item Name', 'Stock', 'Unit', 'Purchase Price', 'Sale Price', 'Stock Value', 'Margin %'];
      case 'item-profit-loss':
        return ['S.No', 'Item Name', 'Stock', 'Cost Price', 'Sale Price', 'Profit/Unit', 'Margin %', 'Potential Profit', 'Status'];
      case 'expense-report':
        return ['S.No', 'Expense No.', 'Date', 'Category', 'Description', 'Amount', 'Payment Mode', 'Vendor'];
      case 'expense-category-wise':
        return ['S.No', 'Category', 'Expenses', 'Total Amount', 'Average', 'Minimum', 'Maximum', 'Cash'];
      case 'full-statement':
        return ['S.No', 'Date', 'Transaction Type', 'Reference No.', 'Party Name', 'Description', 'Debit', 'Credit', 'Balance'];
      default:
        return ['Data'];
    }
  };

  const getTableDataForExport = () => {
    return reportData.map((row, index) => {
      switch (currentReport?.id) {
        case 'sales-report':
          return [
            index + 1,
            row.invoice_number,
            new Date(row.invoice_date).toLocaleDateString(),
            row.party_name || 'N/A',
            `Rs ${formatNumber(row.total_amount)}`,
            `Rs ${formatNumber(row.discount_amount)}`,
            `Rs ${formatNumber(row.net_amount)}`,
            `Rs ${formatNumber(row.paid_amount)}`,
            `Rs ${formatNumber(row.balance_amount)}`
          ];
        case 'purchase-report':
          return [
            index + 1,
            row.invoice_number,
            new Date(row.invoice_date).toLocaleDateString(),
            row.supplier_name || 'N/A',
            `Rs ${formatNumber(row.total_amount)}`,
            `Rs ${formatNumber(row.discount_amount)}`,
            `Rs ${formatNumber(row.net_amount)}`,
            `Rs ${formatNumber(row.paid_amount)}`,
            `Rs ${formatNumber(row.balance_amount)}`
          ];
        case 'day-book':
        case 'all-transactions':
          return [
            index + 1,
            new Date(row.date).toLocaleDateString(),
            row.type,
            row.reference,
            row.flow === 'Debit' ? `Rs ${formatNumber(row.amount)}` : '-',
            row.flow === 'Credit' ? `Rs ${formatNumber(row.amount)}` : '-'
          ];
        case 'cash-flow':
          return [
            index + 1,
            row.account_name,
            row.account_type,
            `Rs ${formatNumber(row.opening_balance)}`,
            `Rs ${formatNumber(row.current_balance)}`,
            `Rs ${formatNumber(Math.abs(row.net_change))}`
          ];
        case 'profit-loss':
          return [
            index + 1,
            row.item_name,
            row.item_type === 'Expenses' ? '' : `Rs ${formatNumber(Math.abs(row.amount))}`
          ];
        case 'party-statement':
          return [
            index + 1,
            row.party_name,
            `Rs ${formatNumber(row.opening_balance)}`,
            `Rs ${formatNumber(row.current_balance)}`,
            `Rs ${formatNumber(row.total_sales)}`,
            row.invoice_count || '0'
          ];
        case 'party-profit-loss':
          return [
            index + 1,
            row.party_name,
            row.total_invoices,
            `Rs ${formatNumber(row.total_sales)}`,
            `Rs ${formatNumber(row.total_discounts)}`,
            `Rs ${formatNumber(row.net_sales)}`,
            `Rs ${formatNumber(row.avg_invoice_value)}`,
            `Rs ${formatNumber(row.outstanding_balance)}`
          ];
        case 'all-parties':
          return [
            index + 1,
            row.party_name,
            row.phone || '-',
            `Rs ${formatNumber(row.current_balance)}`,
            `Rs ${formatNumber(row.lifetime_sales)}`,
            row.total_invoices || '0'
          ];
        case 'stock-summary':
          return [
            index + 1,
            row.item_name,
            row.current_stock,
            row.unit,
            `Rs ${formatNumber(row.purchase_rate)}`,
            `Rs ${formatNumber(row.sale_rate)}`,
            `Rs ${formatNumber(row.stock_value)}`,
            `${row.margin_percentage?.toFixed(1) || '0'}%`
          ];
        case 'item-profit-loss':
          return [
            index + 1,
            row.item_name,
            row.current_stock,
            `Rs ${formatNumber(row.purchase_price)}`,
            `Rs ${formatNumber(row.sale_price)}`,
            `Rs ${formatNumber(row.profit_per_unit)}`,
            `${row.profit_margin_percent?.toFixed(1) || '0'}%`,
            `Rs ${formatNumber(row.potential_profit)}`,
            row.stock_status
          ];
        case 'expense-report':
          return [
            index + 1,
            row.expense_number,
            new Date(row.expense_date).toLocaleDateString(),
            row.category_name || 'Uncategorized',
            row.description,
            `Rs ${formatNumber(row.amount)}`,
            row.payment_mode,
            row.vendor_name || '-'
          ];
        case 'expense-category-wise':
          return [
            index + 1,
            row.category_name,
            row.expense_count,
            `Rs ${formatNumber(row.total_amount)}`,
            `Rs ${formatNumber(row.average_amount)}`,
            `Rs ${formatNumber(row.min_amount)}`,
            `Rs ${formatNumber(row.max_amount)}`,
            `Rs ${formatNumber(row.cash_amount)}`
          ];
        case 'full-statement':
          return [
            row.sno,
            row.date,
            row.transaction_type,
            row.reference,
            row.party_name,
            row.description,
            row.debit === '-' ? '-' : row.debit.replace('₹', 'Rs '),
            row.credit === '-' ? '-' : row.credit.replace('₹', 'Rs '),
            row.balance.replace('₹', 'Rs ')
          ];
        default:
          return [index + 1, 'No data'];
      }
    });
  };

  // All Transactions Report
  const generateAllTransactions = async () => {
    setLoading(true);
    try {
      const transactions = await db.query(`
        SELECT 
          'Sale' as type,
          invoice_number as reference,
          invoice_date as date,
          (total_amount - discount_amount) as amount,
          'Credit' as flow,
          'Customer' as party_type
        FROM sales_invoices 
        WHERE is_deleted = 0 
        AND DATE(invoice_date) >= DATE(?) 
        AND DATE(invoice_date) <= DATE(?)
        
        UNION ALL
        
        SELECT 
          'Purchase' as type,
          bill_number as reference,
          bill_date as date,
          (total_amount - discount_amount) as amount,
          'Debit' as flow,
          'Supplier' as party_type
        FROM purchase_invoices 
        WHERE is_deleted = 0 
        AND DATE(bill_date) >= DATE(?) 
        AND DATE(bill_date) <= DATE(?)
        
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
          CASE 
            WHEN payment_type = 'payment_in' THEN 'Customer'
            WHEN payment_type = 'payment_out' THEN 'Supplier'
            ELSE 'Other'
          END as party_type
        FROM payments 
        WHERE is_deleted = 0 
        AND DATE(payment_date) >= DATE(?) 
        AND DATE(payment_date) <= DATE(?)
        
        ORDER BY date DESC, reference DESC
      `, [
        dateFilter.from, dateFilter.to,
        dateFilter.from, dateFilter.to, 
        dateFilter.from, dateFilter.to
      ]);

      const totalCredit = transactions.filter(t => t.flow === 'Credit').reduce((sum, t) => sum + t.amount, 0);
      const totalDebit = transactions.filter(t => t.flow === 'Debit').reduce((sum, t) => sum + t.amount, 0);
      const netFlow = totalCredit - totalDebit;

      setReportData(transactions);
      setReportSummary({
        totalCredit,
        totalDebit,
        netFlow,
        transactionCount: transactions.length,
        salesCount: transactions.filter(t => t.type === 'Sale').length,
        purchaseCount: transactions.filter(t => t.type === 'Purchase').length
      });
    } catch (error) {
      console.error('Error generating all transactions report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cash Flow Report
  const generateCashFlow = async () => {
    setLoading(true);
    try {
      const cashFlowData = await db.query(`
        SELECT 
          a.account_name,
          a.account_type,
          a.opening_balance,
          a.current_balance,
          (a.current_balance - a.opening_balance) as net_change
        FROM accounts a
        WHERE a.is_deleted = 0
        ORDER BY a.account_type, a.account_name
      `);

      // Calculate cash flow summary
      const totalOpening = cashFlowData.reduce((sum, acc) => sum + (acc.opening_balance || 0), 0);
      const totalCurrent = cashFlowData.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
      const netChange = totalCurrent - totalOpening;

      setReportData(cashFlowData);
      setReportSummary({
        totalOpening,
        totalCurrent,
        netChange,
        accountCount: cashFlowData.length
      });
    } catch (error) {
      console.error('Error generating cash flow report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Profit & Loss Report
  const generateProfitLoss = async () => {
    setLoading(true);
    try {
      // Get sales revenue
      const salesData = await db.query(`
        SELECT SUM(total_amount - discount_amount) as total_sales
        FROM sales_invoices 
        WHERE is_deleted = 0 
        AND DATE(invoice_date) >= DATE(?) 
        AND DATE(invoice_date) <= DATE(?)
      `, [dateFilter.from, dateFilter.to]);

      // Get purchase costs
      const purchaseData = await db.query(`
        SELECT SUM(total_amount - discount_amount) as total_purchases
        FROM purchase_invoices 
        WHERE is_deleted = 0 
        AND DATE(bill_date) >= DATE(?) 
        AND DATE(bill_date) <= DATE(?)
      `, [dateFilter.from, dateFilter.to]);

      // Get expenses
      const expenseData = await db.query(`
        SELECT 
          ec.category_name,
          SUM(e.amount) as total_amount
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
        WHERE e.is_deleted = 0 
        AND DATE(e.expense_date) >= DATE(?) 
        AND DATE(e.expense_date) <= DATE(?)
        GROUP BY e.category_id, ec.category_name
        ORDER BY total_amount DESC
      `, [dateFilter.from, dateFilter.to]);

      const totalSales = salesData[0]?.total_sales || 0;
      const totalPurchases = purchaseData[0]?.total_purchases || 0;
      const totalExpenses = expenseData.reduce((sum, exp) => sum + (exp.total_amount || 0), 0);
      const grossProfit = totalSales - totalPurchases;
      const netProfit = grossProfit - totalExpenses;

      // Create P&L structure data for display
      const plData = [
        { item_type: 'Revenue', item_name: 'Sales Revenue', amount: totalSales },
        { item_type: 'COGS', item_name: 'Cost of Goods Sold (Purchases)', amount: totalPurchases },
        { item_type: 'Gross', item_name: 'Gross Profit', amount: grossProfit }
      ];

      // Add expense categories if any exist
      if (expenseData.length > 0) {
        plData.push({ item_type: 'Expenses', item_name: 'Operating Expenses:', amount: 0 });
        expenseData.forEach(expense => {
          plData.push({ 
            item_type: 'Expense', 
            item_name: `  ${expense.category_name}`, 
            amount: expense.total_amount 
          });
        });
        plData.push({ item_type: 'Total Expenses', item_name: 'Total Operating Expenses', amount: totalExpenses });
      }

      plData.push({ item_type: 'Net', item_name: 'Net Profit', amount: netProfit });

      setReportData(plData);
      setReportSummary({
        totalSales,
        totalPurchases,
        totalExpenses,
        grossProfit,
        netProfit,
        grossMargin: totalSales ? ((grossProfit / totalSales) * 100) : 0,
        netMargin: totalSales ? ((netProfit / totalSales) * 100) : 0
      });
    } catch (error) {
      console.error('Error generating profit & loss report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Party Statement Report
  const generatePartyStatement = async () => {
    setLoading(true);
    try {
      const partyData = await db.query(`
        SELECT 
          p.name as party_name,
          p.opening_balance,
          p.current_balance,
          (p.current_balance - p.opening_balance) as balance_change,
          COUNT(si.invoice_id) as invoice_count,
          COALESCE(SUM(si.total_amount), 0) as total_sales
        FROM parties p
        LEFT JOIN sales_invoices si ON p.party_id = si.party_id 
          AND si.is_deleted = 0
          AND DATE(si.invoice_date) >= DATE(?) 
          AND DATE(si.invoice_date) <= DATE(?)
        WHERE p.is_deleted = 0
        GROUP BY p.party_id, p.name, p.opening_balance, p.current_balance
        ORDER BY total_sales DESC
      `, [dateFilter.from, dateFilter.to]);

      const totalOutstanding = partyData.reduce((sum, party) => sum + (party.current_balance || 0), 0);
      const totalSales = partyData.reduce((sum, party) => sum + (party.total_sales || 0), 0);

      setReportData(partyData);
      setReportSummary({
        totalParties: partyData.length,
        totalOutstanding,
        totalSales,
        averageBalance: totalOutstanding / (partyData.length || 1)
      });
    } catch (error) {
      console.error('Error generating party statement:', error);
    } finally {
      setLoading(false);
    }
  };

  // All Parties Report
  const generateAllParties = async () => {
    setLoading(true);
    try {
      const allPartiesData = await db.query(`
        SELECT 
          p.name as party_name,
          p.phone,
          p.address,
          p.opening_balance,
          p.current_balance,
          p.created_at,
          COUNT(si.invoice_id) as total_invoices,
          COALESCE(SUM(si.total_amount), 0) as lifetime_sales
        FROM parties p
        LEFT JOIN sales_invoices si ON p.party_id = si.party_id AND si.is_deleted = 0
        WHERE p.is_deleted = 0
        GROUP BY p.party_id, p.name, p.phone, p.address, p.opening_balance, p.current_balance, p.created_at
        ORDER BY lifetime_sales DESC
      `);

      const totalParties = allPartiesData.length;
      const totalLifetimeSales = allPartiesData.reduce((sum, party) => sum + (party.lifetime_sales || 0), 0);
      const totalOutstanding = allPartiesData.reduce((sum, party) => sum + (party.current_balance || 0), 0);

      setReportData(allPartiesData);
      setReportSummary({
        totalParties,
        totalLifetimeSales,
        totalOutstanding,
        averageLifetimeValue: totalLifetimeSales / (totalParties || 1)
      });
    } catch (error) {
      console.error('Error generating all parties report:', error);
    } finally {
      setLoading(false);
    }
  };


  // Party Wise Profit & Loss Report
  const generatePartyProfitLoss = async () => {
    setLoading(true);
    try {
      const partyPLData = await db.query(`
        SELECT 
          p.name as party_name,
          COUNT(si.invoice_id) as total_invoices,
          SUM(si.total_amount) as total_sales,
          SUM(si.discount_amount) as total_discounts,
          SUM(si.total_amount - si.discount_amount) as net_sales,
          AVG(si.total_amount - si.discount_amount) as avg_invoice_value,
          p.current_balance as outstanding_balance,
          p.created_at as customer_since
        FROM parties p
        LEFT JOIN sales_invoices si ON p.party_id = si.party_id 
          AND si.is_deleted = 0
          AND DATE(si.invoice_date) >= DATE(?) 
          AND DATE(si.invoice_date) <= DATE(?)
        WHERE p.is_deleted = 0
        GROUP BY p.party_id, p.name, p.current_balance, p.created_at
        HAVING total_invoices > 0
        ORDER BY net_sales DESC
      `, [dateFilter.from, dateFilter.to]);

      // Calculate totals
      const totalNetSales = partyPLData.reduce((sum, party) => sum + (party.net_sales || 0), 0);
      const totalOutstanding = partyPLData.reduce((sum, party) => sum + (party.outstanding_balance || 0), 0);
      const totalInvoices = partyPLData.reduce((sum, party) => sum + (party.total_invoices || 0), 0);
      const totalDiscounts = partyPLData.reduce((sum, party) => sum + (party.total_discounts || 0), 0);

      setReportData(partyPLData);
      setReportSummary({
        totalParties: partyPLData.length,
        totalNetSales,
        totalOutstanding,
        totalInvoices,
        totalDiscounts,
        averagePartyValue: totalNetSales / (partyPLData.length || 1)
      });
    } catch (error) {
      console.error('Error generating party profit & loss:', error);
    } finally {
      setLoading(false);
    }
  };

  // Item Wise Profit & Loss Report
  const generateItemProfitLoss = async () => {
    setLoading(true);
    try {
      // For now, we'll use stock data with calculated margins since we don't have item-wise sales tracking
      // This gives a theoretical profit/loss based on purchase vs sale prices
      const itemPLData = await db.query(`
        SELECT 
          i.product_name as item_name,
          i.current_stock,
          i.unit,
          i.purchase_price,
          i.sale_price,
          (i.current_stock * i.purchase_price) as stock_value_cost,
          (i.current_stock * i.sale_price) as stock_value_retail,
          (i.sale_price - i.purchase_price) as profit_per_unit,
          ((i.sale_price - i.purchase_price) / i.sale_price * 100) as profit_margin_percent,
          (i.current_stock * (i.sale_price - i.purchase_price)) as potential_profit,
          i.opening_stock,
          i.min_stock,
          CASE 
            WHEN i.current_stock <= i.min_stock THEN 'Low Stock'
            WHEN i.current_stock > i.min_stock * 3 THEN 'Overstock'
            ELSE 'Normal'
          END as stock_status
        FROM items i
        WHERE i.is_deleted = 0 AND i.current_stock > 0
        ORDER BY potential_profit DESC
      `);

      // Calculate totals
      const totalStockValueCost = itemPLData.reduce((sum, item) => sum + (item.stock_value_cost || 0), 0);
      const totalStockValueRetail = itemPLData.reduce((sum, item) => sum + (item.stock_value_retail || 0), 0);
      const totalPotentialProfit = itemPLData.reduce((sum, item) => sum + (item.potential_profit || 0), 0);
      const avgProfitMargin = itemPLData.length > 0 ? 
        itemPLData.reduce((sum, item) => sum + (item.profit_margin_percent || 0), 0) / itemPLData.length : 0;

      setReportData(itemPLData);
      setReportSummary({
        totalItems: itemPLData.length,
        totalStockValueCost,
        totalStockValueRetail,
        totalPotentialProfit,
        avgProfitMargin,
        profitabilityRatio: totalStockValueCost > 0 ? (totalPotentialProfit / totalStockValueCost * 100) : 0
      });
    } catch (error) {
      console.error('Error generating item profit & loss:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expense Report
  const generateExpenseReport = async () => {
    setLoading(true);
    try {
      const expenseData = await db.query(`
        SELECT 
          e.expense_number,
          e.expense_date,
          ec.category_name,
          e.description,
          e.amount,
          a.account_name,
          e.payment_mode,
          e.bill_number,
          e.vendor_name,
          e.notes
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
        LEFT JOIN accounts a ON e.account_id = a.account_id
        WHERE e.is_deleted = 0 
        AND DATE(e.expense_date) >= DATE(?) 
        AND DATE(e.expense_date) <= DATE(?)
        ORDER BY e.expense_date DESC, e.expense_number DESC
      `, [dateFilter.from, dateFilter.to]);

      // Calculate summary
      const totalExpenses = expenseData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const uniqueCategories = new Set(expenseData.map(exp => exp.category_name)).size;
      const averageExpense = totalExpenses / (expenseData.length || 1);
      const cashExpenses = expenseData.filter(exp => exp.payment_mode === 'cash').reduce((sum, exp) => sum + exp.amount, 0);
      const bankExpenses = expenseData.filter(exp => exp.payment_mode !== 'cash').reduce((sum, exp) => sum + exp.amount, 0);

      setReportData(expenseData);
      setReportSummary({
        totalExpenses,
        expenseCount: expenseData.length,
        uniqueCategories,
        averageExpense,
        cashExpenses,
        bankExpenses
      });
    } catch (error) {
      console.error('Error generating expense report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Category Wise Expense Report
  const generateExpenseCategoryWise = async () => {
    setLoading(true);
    try {
      const categoryData = await db.query(`
        SELECT 
          ec.category_name,
          COUNT(e.expense_id) as expense_count,
          SUM(e.amount) as total_amount,
          AVG(e.amount) as average_amount,
          MIN(e.amount) as min_amount,
          MAX(e.amount) as max_amount,
          SUM(CASE WHEN e.payment_mode = 'cash' THEN e.amount ELSE 0 END) as cash_amount,
          SUM(CASE WHEN e.payment_mode != 'cash' THEN e.amount ELSE 0 END) as non_cash_amount
        FROM expense_categories ec
        LEFT JOIN expenses e ON ec.category_id = e.category_id 
          AND e.is_deleted = 0
          AND DATE(e.expense_date) >= DATE(?) 
          AND DATE(e.expense_date) <= DATE(?)
        WHERE ec.is_deleted = 0 AND ec.is_active = 1
        GROUP BY ec.category_id, ec.category_name
        HAVING expense_count > 0
        ORDER BY total_amount DESC
      `, [dateFilter.from, dateFilter.to]);

      // Calculate totals
      const totalExpenses = categoryData.reduce((sum, cat) => sum + (cat.total_amount || 0), 0);
      const totalCategories = categoryData.length;
      const highestCategory = categoryData.length > 0 ? categoryData[0] : null;
      const averageCategorySpend = totalExpenses / (totalCategories || 1);

      setReportData(categoryData);
      setReportSummary({
        totalExpenses,
        totalCategories,
        highestCategory: highestCategory?.category_name || 'N/A',
        highestCategoryAmount: highestCategory?.total_amount || 0,
        averageCategorySpend
      });
    } catch (error) {
      console.error('Error generating category wise expense report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stock Summary Report
  const generateStockSummary = async () => {
    setLoading(true);
    try {
      const stockData = await db.query(`
        SELECT 
          i.product_name as item_name,
          i.current_stock,
          i.unit,
          i.purchase_price as purchase_rate,
          i.sale_price as sale_rate,
          (i.current_stock * i.purchase_price) as stock_value,
          (i.sale_price - i.purchase_price) as margin_per_unit,
          CASE 
            WHEN i.sale_price > 0 THEN ((i.sale_price - i.purchase_price) / i.sale_price * 100)
            ELSE 0
          END as margin_percentage
        FROM items i
        WHERE i.is_deleted = 0
        ORDER BY stock_value DESC
      `);

      const totalStockValue = stockData.reduce((sum, item) => sum + (item.stock_value || 0), 0);
      const totalItems = stockData.length;
      const lowStockItems = stockData.filter(item => item.current_stock < 10).length;

      setReportData(stockData);
      setReportSummary({
        totalItems,
        totalStockValue,
        lowStockItems,
        averageStockValue: totalStockValue / (totalItems || 1)
      });
    } catch (error) {
      console.error('Error generating stock summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate Full Statement Report
  const generateFullStatement = async () => {
    try {
      setLoading(true);
      console.log('🔄 Generating Full Statement Report...', { dateFilter, partyFilter });

      // Collect all transactions with comprehensive data
      const transactions = [];
      let runningBalance = 0;

      // 1. Get Sales Invoices
      let salesQuery = `
        SELECT 
          si.invoice_date as date,
          'Sales' as type,
          si.invoice_number as reference,
          COALESCE(p.name, 'Cash Customer') as party_name,
          'Sales Invoice - ' || COALESCE(si.notes, 'Direct Sale') as description,
          0 as debit,
          si.total_amount as credit,
          si.created_at,
          'sales' as category
        FROM sales_invoices si
        LEFT JOIN parties p ON si.party_id = p.party_id
        WHERE si.is_deleted = 0 
        AND DATE(si.invoice_date) >= DATE(?) 
        AND DATE(si.invoice_date) <= DATE(?)
      `;
      const salesParams = [dateFilter.from, dateFilter.to];
      
      if (partyFilter) {
        salesQuery += ' AND si.party_id = ?';
        salesParams.push(partyFilter);
      }

      const salesData = await db.query(salesQuery, salesParams);

      // 2. Get Payment In Transactions
      let paymentInQuery = `
        SELECT 
          p.payment_date as date,
          'Payment In' as type,
          p.payment_number as reference,
          COALESCE(pt.name, 'Direct Payment') as party_name,
          'Payment Received - ' || COALESCE(p.notes, 'Direct Payment') as description,
          0 as debit,
          p.amount as credit,
          p.created_at,
          'payment_in' as category
        FROM payments p
        LEFT JOIN parties pt ON p.party_id = pt.party_id
        WHERE p.payment_type = 'payment_in' 
        AND p.is_deleted = 0 
        AND DATE(p.payment_date) >= DATE(?) 
        AND DATE(p.payment_date) <= DATE(?)
      `;
      const paymentInParams = [dateFilter.from, dateFilter.to];
      
      if (partyFilter) {
        paymentInQuery += ' AND p.party_id = ?';
        paymentInParams.push(partyFilter);
      }

      const paymentInData = await db.query(paymentInQuery, paymentInParams);

      // 3. Get Payment Out Transactions
      let paymentOutQuery = `
        SELECT 
          p.payment_date as date,
          'Payment Out' as type,
          p.payment_number as reference,
          COALESCE(pt.name, 'Direct Payment') as party_name,
          'Payment Made - ' || COALESCE(p.notes, 'Direct Payment') as description,
          p.amount as debit,
          0 as credit,
          p.created_at,
          'payment_out' as category
        FROM payments p
        LEFT JOIN parties pt ON p.party_id = pt.party_id
        WHERE p.payment_type = 'payment_out' 
        AND p.is_deleted = 0 
        AND DATE(p.payment_date) >= DATE(?) 
        AND DATE(p.payment_date) <= DATE(?)
      `;
      const paymentOutParams = [dateFilter.from, dateFilter.to];
      
      if (partyFilter) {
        paymentOutQuery += ' AND p.party_id = ?';
        paymentOutParams.push(partyFilter);
      }

      const paymentOutData = await db.query(paymentOutQuery, paymentOutParams);

      // 4. Get Expenses (when no party filter or show all)
      let expenseData = [];
      if (!partyFilter) {
        let expenseQuery = `
          SELECT 
            e.expense_date as date,
            'Expense' as type,
            e.expense_number as reference,
            COALESCE(e.vendor_name, 'Direct Expense') as party_name,
            'Expense - ' || e.description as description,
            e.amount as debit,
            0 as credit,
            e.created_at,
            'expense' as category
          FROM expenses e
          WHERE e.is_deleted = 0 
          AND DATE(e.expense_date) >= DATE(?) 
          AND DATE(e.expense_date) <= DATE(?)
        `;
        const expenseParams = [dateFilter.from, dateFilter.to];
        expenseData = await db.query(expenseQuery, expenseParams);
      }

      // Combine all transactions
      const allTransactions = [
        ...salesData,
        ...paymentInData,
        ...paymentOutData,
        ...expenseData
      ];

      // Sort by date and time (oldest first)
      allTransactions.sort((a, b) => {
        // Parse dates properly to ensure correct sorting
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        console.log('Sorting:', a.date, 'vs', b.date, '→', dateA, 'vs', dateB);
        return dateA - dateB; // Ascending order (old to new)
      });

      // Calculate running balance and format data
      const formattedData = allTransactions.map((txn, index) => {
        const credit = parseFloat(txn.credit) || 0;
        const debit = parseFloat(txn.debit) || 0;
        runningBalance += credit - debit;

        return {
          sno: index + 1,
          date: new Date(txn.date).toLocaleDateString(),
          transaction_type: txn.type,
          reference: txn.reference,
          party_name: txn.party_name,
          description: txn.description,
          debit: debit > 0 ? `₹${debit.toLocaleString()}` : '-',
          credit: credit > 0 ? `₹${credit.toLocaleString()}` : '-',
          balance: `₹${runningBalance.toLocaleString()}`
        };
      });

      // Calculate summary
      const totalCredit = allTransactions.reduce((sum, txn) => sum + (parseFloat(txn.credit) || 0), 0);
      const totalDebit = allTransactions.reduce((sum, txn) => sum + (parseFloat(txn.debit) || 0), 0);
      const netBalance = totalCredit - totalDebit;

      setReportData(formattedData);
      setReportSummary({
        total_transactions: allTransactions.length,
        total_credit: totalCredit,
        total_debit: totalDebit,
        net_balance: netBalance,
        date_range: `${dateFilter.from} to ${dateFilter.to}`,
        party_filter: partyFilter ? parties.find(p => p.party_id === parseInt(partyFilter))?.name : 'All Parties'
      });

      console.log('✅ Full Statement Report generated:', {
        transactions: allTransactions.length,
        totalCredit,
        totalDebit,
        netBalance
      });

    } catch (error) {
      console.error('❌ Error generating full statement:', error);
      showToast.error('Error generating full statement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Report definitions with modern styling
  const reportCategories = [
    {
      title: "📊 Transaction Reports",
      reports: [
        {
          id: 'sales-report',
          title: 'Sales Report',
          description: 'Detailed sales transactions and performance analysis',
          icon: FileText,
          color: 'blue',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-blue-700'
        },
        {
          id: 'purchase-report',
          title: 'Purchase Report', 
          description: 'Purchase transactions and supplier analysis',
          icon: FileText,
          color: 'green',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-700'
        },
        {
          id: 'day-book',
          title: 'Day Book',
          description: 'Daily transactions and cash flow summary',
          icon: Calendar,
          color: 'purple',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-700'
        },
        {
          id: 'all-transactions',
          title: 'All Transactions Report',
          description: 'Complete transaction history across all modules',
          icon: FileText,
          color: 'orange',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-700'
        },
        {
          id: 'cash-flow',
          title: 'Cash Flow',
          description: 'Cash inflow and outflow analysis',
          icon: TrendingUp,
          color: 'teal',
          bgColor: 'bg-teal-50',
          borderColor: 'border-teal-200',
          textColor: 'text-teal-700'
        },
        {
          id: 'expense-report',
          title: 'Expense Report',
          description: 'Detailed expense analysis and category breakdown',
          icon: FileText,
          color: 'red',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700'
        },
        {
          id: 'expense-category-wise',
          title: 'Category Wise Expenses',
          description: 'Expense analysis by category and trends',
          icon: BarChart3,
          color: 'orange',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-700'
        },
        {
          id: 'full-statement',
          title: 'Full Statement',
          description: 'Complete statement with all transactions - sales, payments, expenses with party filter',
          icon: FileText,
          color: 'indigo',
          bgColor: 'bg-indigo-50',
          borderColor: 'border-indigo-200',
          textColor: 'text-indigo-700'
        }
      ]
    },
    {
      title: "💰 Financial Reports",
      reports: [
        {
          id: 'profit-loss',
          title: 'Profit & Loss',
          description: 'Income statement and profitability analysis',
          icon: TrendingUp,
          color: 'red',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700'
        },
      ]
    },
    {
      title: "👥 Party Reports",
      reports: [
        {
          id: 'party-statement',
          title: 'Party Statement',
          description: 'Individual party transaction statements and outstanding balances',
          icon: Users,
          color: 'pink',
          bgColor: 'bg-pink-50',
          borderColor: 'border-pink-200',
          textColor: 'text-pink-700'
        },
        {
          id: 'party-profit-loss',
          title: 'Party Wise Profit & Loss',
          description: 'Profit and loss analysis by individual party/customer',
          icon: TrendingUp,
          color: 'cyan',
          bgColor: 'bg-cyan-50',
          borderColor: 'border-cyan-200',
          textColor: 'text-cyan-700'
        },
        {
          id: 'all-parties',
          title: 'All Parties Report',
          description: 'Comprehensive party-wise business summary and analytics',
          icon: Users,
          color: 'amber',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-700'
        }
      ]
    },
    {
      title: "📦 Item / Stock Reports",
      reports: [
        {
          id: 'stock-summary',
          title: 'Stock Summary Report',
          description: 'Current stock levels, valuation and inventory overview',
          icon: Package,
          color: 'emerald',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          textColor: 'text-emerald-700'
        },
        {
          id: 'item-profit-loss',
          title: 'Item Wise Profit & Loss',
          description: 'Profitability analysis by product/item with margin details',
          icon: TrendingUp,
          color: 'lime',
          bgColor: 'bg-lime-50',
          borderColor: 'border-lime-200',
          textColor: 'text-lime-700'
        },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentReport && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentReport(null)}
                className="border-fatima-green text-fatima-green hover:bg-fatima-green hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Reports
              </Button>
            )}
            <h1 className="text-3xl font-bold bg-gradient-to-r from-fatima-green to-fatima-green bg-clip-text text-transparent">
              {currentReport ? currentReport.title : 'Business Reports'}
            </h1>
          </div>
          
          {/* Date Filter */}
          <div className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm border">
            <Calendar className="w-5 h-5 text-fatima-green" />
            <span className="text-sm font-medium text-gray-700">From:</span>
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border border-green-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-fatima-green text-sm font-medium">to</span>
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border border-green-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fatima-green focus:border-fatima-green"
              style={{ colorScheme: 'light' }}
            />
            {/* Party Filter - Show for Sales Report and Full Statement */}
            {currentReport && (currentReport.id === 'sales-report' || currentReport.id === 'full-statement') && (
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Party</label>
                <div className="relative party-dropdown-container">
                  <input
                    type="text"
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value);
                      setShowPartyDropdown(true);
                    }}
                    onFocus={() => setShowPartyDropdown(true)}
                    placeholder="Search parties..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  />
                  <div 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer"
                    onClick={() => setShowPartyDropdown(!showPartyDropdown)}
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  
                  {showPartyDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      <div 
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                        onClick={() => {
                          setPartyFilter('');
                          setPartySearch('');
                          setShowPartyDropdown(false);
                          if (currentReport) {
                            handleReportSelect(currentReport);
                          }
                        }}
                      >
                        All Parties
                      </div>
                      {filteredParties.map(party => (
                        <div 
                          key={party.party_id}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                          onClick={() => handlePartySelect(party.party_id, party.name)}
                        >
                          {party.name}
                        </div>
                      ))}
                      {filteredParties.length === 0 && partySearch && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No parties found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button size="sm" className="bg-fatima-green hover:bg-fatima-green/90" onClick={applyDateFilter}>
              Apply
            </Button>
          </div>
        </div>

        {!currentReport ? (
          // Reports Dashboard
          <div className="space-y-8">
            {reportCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-2">
                  {category.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.reports.map((report) => {
                    const IconComponent = report.icon;
                    return (
                      <Card 
                        key={report.id}
                        className={`${report.bgColor} ${report.borderColor} border-2 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group`}
                        onClick={() => handleReportSelect(report)}
                      >
                        <CardHeader>
                          <CardTitle className={`flex items-center gap-3 ${report.textColor} group-hover:scale-105 transition-transform`}>
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <span className="text-lg font-semibold">{report.title}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                            {report.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${report.textColor} font-medium bg-white px-2 py-1 rounded-full`}>
                              Click to view
                            </span>
                            <BarChart3 className={`w-4 h-4 ${report.textColor} opacity-70`} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Individual Report View
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-fatima-green to-fatima-green text-white">
                <CardTitle className="flex items-center gap-3">
                  <currentReport.icon className="w-6 h-6" />
                  {currentReport.title}
                  <div className="ml-auto flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-white text-white hover:bg-white hover:text-fatima-green"
                      onClick={exportToPDF}
                      disabled={!reportData.length}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-white text-white hover:bg-white hover:text-fatima-green"
                      onClick={exportToExcel}
                      disabled={!reportData.length}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fatima-green mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating {currentReport.title}...</p>
                  </div>
                ) : reportData.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {currentReport.id === 'sales-report' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Sales</h3>
                            <p className="text-2xl font-bold text-blue-700">₹{reportSummary.totalSales?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Invoices</h3>
                            <p className="text-2xl font-bold text-green-700">{reportSummary.uniqueInvoices}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageValue?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Total Discount</h3>
                            <p className="text-2xl font-bold text-orange-700">₹{reportSummary.totalDiscount?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'purchase-report' && (
                        <>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Purchases</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalPurchases?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Invoices</h3>
                            <p className="text-2xl font-bold text-green-700">{reportSummary.uniqueInvoices}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageValue?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Total Discount</h3>
                            <p className="text-2xl font-bold text-orange-700">₹{reportSummary.totalDiscount?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'day-book' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Total Credit</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalCredit?.toLocaleString()}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Debit</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalDebit?.toLocaleString()}</p>
                          </div>
                          <div className={`p-4 rounded-lg border ${reportSummary.netFlow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <h3 className={`text-sm font-medium mb-1 ${reportSummary.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Flow</h3>
                            <p className={`text-2xl font-bold ${reportSummary.netFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{Math.abs(reportSummary.netFlow)?.toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Transactions</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.transactionCount}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'all-transactions' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Total Credit</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalCredit?.toLocaleString()}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Debit</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalDebit?.toLocaleString()}</p>
                          </div>
                          <div className={`p-4 rounded-lg border ${reportSummary.netFlow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <h3 className={`text-sm font-medium mb-1 ${reportSummary.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Flow</h3>
                            <p className={`text-2xl font-bold ${reportSummary.netFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{Math.abs(reportSummary.netFlow)?.toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Transactions</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.transactionCount}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'cash-flow' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Opening Balance</h3>
                            <p className="text-2xl font-bold text-blue-700">₹{reportSummary.totalOpening?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Current Balance</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalCurrent?.toLocaleString()}</p>
                          </div>
                          <div className={`p-4 rounded-lg border ${reportSummary.netChange >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <h3 className={`text-sm font-medium mb-1 ${reportSummary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Change</h3>
                            <p className={`text-2xl font-bold ${reportSummary.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{Math.abs(reportSummary.netChange)?.toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Accounts</h3>
                            <p className="text-2xl font-bold text-purple-700">{reportSummary.accountCount}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'profit-loss' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Total Sales</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalSales?.toLocaleString()}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Purchases</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalPurchases?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Gross Profit</h3>
                            <p className="text-2xl font-bold text-blue-700">₹{reportSummary.grossProfit?.toLocaleString()}</p>
                          </div>
                          <div className={`p-4 rounded-lg border ${reportSummary.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <h3 className={`text-sm font-medium mb-1 ${reportSummary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</h3>
                            <p className={`text-2xl font-bold ${reportSummary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{Math.abs(reportSummary.netProfit)?.toLocaleString()}
                            </p>
                          </div>
                        </>
                      )}
                      
                      
                      {currentReport.id === 'party-statement' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Parties</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalParties}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Total Sales</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalSales?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Outstanding</h3>
                            <p className="text-2xl font-bold text-orange-700">₹{reportSummary.totalOutstanding?.toLocaleString()}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Balance</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageBalance?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'all-parties' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Parties</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalParties}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Lifetime Sales</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalLifetimeSales?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Outstanding</h3>
                            <p className="text-2xl font-bold text-orange-700">₹{reportSummary.totalOutstanding?.toLocaleString()}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Lifetime Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageLifetimeValue?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'party-profit-loss' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Active Parties</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalParties}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Total Net Sales</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalNetSales?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Total Invoices</h3>
                            <p className="text-2xl font-bold text-orange-700">{reportSummary.totalInvoices}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Party Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averagePartyValue?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'stock-summary' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Items</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalItems}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Stock Value</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalStockValue?.toLocaleString()}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Low Stock Items</h3>
                            <p className="text-2xl font-bold text-red-700">{reportSummary.lowStockItems}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. Stock Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageStockValue?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'item-profit-loss' && (
                        <>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Items</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalItems}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Potential Profit</h3>
                            <p className="text-2xl font-bold text-green-700">₹{reportSummary.totalPotentialProfit?.toLocaleString()}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Avg. Margin</h3>
                            <p className="text-2xl font-bold text-orange-700">{reportSummary.avgProfitMargin?.toFixed(1)}%</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Cost Value</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.totalStockValueCost?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'expense-report' && (
                        <>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Expenses</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalExpenses?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Total Entries</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.expenseCount}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Categories Used</h3>
                            <p className="text-2xl font-bold text-purple-700">{reportSummary.uniqueCategories}</p>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h3 className="text-sm font-medium text-orange-600 mb-1">Average Expense</h3>
                            <p className="text-2xl font-bold text-orange-700">₹{reportSummary.averageExpense?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                      
                      {currentReport.id === 'expense-category-wise' && (
                        <>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-medium text-red-600 mb-1">Total Expenses</h3>
                            <p className="text-2xl font-bold text-red-700">₹{reportSummary.totalExpenses?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-fatima-green mb-1">Active Categories</h3>
                            <p className="text-2xl font-bold text-blue-700">{reportSummary.totalCategories}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h3 className="text-sm font-medium text-green-600 mb-1">Highest Category</h3>
                            <p className="text-xl font-bold text-green-700">{reportSummary.highestCategory}</p>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h3 className="text-sm font-medium text-purple-600 mb-1">Avg. per Category</h3>
                            <p className="text-2xl font-bold text-purple-700">₹{reportSummary.averageCategorySpend?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Data Table */}
                    <div className="bg-white rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 border-b-2 border-gray-200">
                            {currentReport.id === 'sales-report' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Invoice No.</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-left font-semibold">Party</TableHead>
                                <TableHead className="text-right font-semibold">Total Amount</TableHead>
                                <TableHead className="text-right font-semibold">Discount</TableHead>
                                <TableHead className="text-right font-semibold">Net Amount</TableHead>
                                <TableHead className="text-right font-semibold">Paid</TableHead>
                                <TableHead className="text-right font-semibold">Balance</TableHead>
                              </>
                            )}
                            {currentReport.id === 'purchase-report' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Bill No.</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-left font-semibold">Supplier</TableHead>
                                <TableHead className="text-right font-semibold">Total Amount</TableHead>
                                <TableHead className="text-right font-semibold">Discount</TableHead>
                                <TableHead className="text-right font-semibold">Net Amount</TableHead>
                                <TableHead className="text-right font-semibold">Paid</TableHead>
                                <TableHead className="text-right font-semibold">Balance</TableHead>
                              </>
                            )}
                            {currentReport.id === 'day-book' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-center font-semibold">Type</TableHead>
                                <TableHead className="text-left font-semibold">Reference</TableHead>
                                <TableHead className="text-right font-semibold">Debit</TableHead>
                                <TableHead className="text-right font-semibold">Credit</TableHead>
                              </>
                            )}
                            {currentReport.id === 'all-transactions' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-center font-semibold">Type</TableHead>
                                <TableHead className="text-left font-semibold">Reference</TableHead>
                                <TableHead className="text-center font-semibold">Party Type</TableHead>
                                <TableHead className="text-right font-semibold">Debit</TableHead>
                                <TableHead className="text-right font-semibold">Credit</TableHead>
                              </>
                            )}
                            {currentReport.id === 'cash-flow' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Account</TableHead>
                                <TableHead className="text-center font-semibold">Type</TableHead>
                                <TableHead className="text-right font-semibold">Opening</TableHead>
                                <TableHead className="text-right font-semibold">Current</TableHead>
                                <TableHead className="text-right font-semibold">Change</TableHead>
                              </>
                            )}
                            {currentReport.id === 'profit-loss' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Item</TableHead>
                                <TableHead className="text-right font-semibold">Amount</TableHead>
                              </>
                            )}
                            {currentReport.id === 'party-statement' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Party Name</TableHead>
                                <TableHead className="text-right font-semibold">Opening Balance</TableHead>
                                <TableHead className="text-right font-semibold">Current Balance</TableHead>
                                <TableHead className="text-right font-semibold">Total Sales</TableHead>
                                <TableHead className="text-center font-semibold">Invoices</TableHead>
                              </>
                            )}
                            {currentReport.id === 'all-parties' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Party Name</TableHead>
                                <TableHead className="text-center font-semibold">Phone</TableHead>
                                <TableHead className="text-right font-semibold">Current Balance</TableHead>
                                <TableHead className="text-right font-semibold">Lifetime Sales</TableHead>
                                <TableHead className="text-center font-semibold">Total Invoices</TableHead>
                              </>
                            )}
                            {currentReport.id === 'party-profit-loss' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Party Name</TableHead>
                                <TableHead className="text-center font-semibold">Invoices</TableHead>
                                <TableHead className="text-right font-semibold">Total Sales</TableHead>
                                <TableHead className="text-right font-semibold">Discounts</TableHead>
                                <TableHead className="text-right font-semibold">Net Sales</TableHead>
                                <TableHead className="text-right font-semibold">Avg. Invoice</TableHead>
                                <TableHead className="text-right font-semibold">Outstanding</TableHead>
                              </>
                            )}
                            {currentReport.id === 'stock-summary' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Item Name</TableHead>
                                <TableHead className="text-right font-semibold">Stock</TableHead>
                                <TableHead className="text-center font-semibold">Unit</TableHead>
                                <TableHead className="text-right font-semibold">Purchase Price</TableHead>
                                <TableHead className="text-right font-semibold">Sale Price</TableHead>
                                <TableHead className="text-right font-semibold">Stock Value</TableHead>
                                <TableHead className="text-right font-semibold">Margin %</TableHead>
                              </>
                            )}
                            {currentReport.id === 'item-profit-loss' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Item Name</TableHead>
                                <TableHead className="text-right font-semibold">Stock</TableHead>
                                <TableHead className="text-right font-semibold">Cost Price</TableHead>
                                <TableHead className="text-right font-semibold">Sale Price</TableHead>
                                <TableHead className="text-right font-semibold">Profit/Unit</TableHead>
                                <TableHead className="text-right font-semibold">Margin %</TableHead>
                                <TableHead className="text-right font-semibold">Potential Profit</TableHead>
                                <TableHead className="text-center font-semibold">Status</TableHead>
                              </>
                            )}
                            {currentReport.id === 'expense-report' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Expense No.</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-left font-semibold">Category</TableHead>
                                <TableHead className="text-left font-semibold">Description</TableHead>
                                <TableHead className="text-right font-semibold">Amount</TableHead>
                                <TableHead className="text-center font-semibold">Payment Mode</TableHead>
                                <TableHead className="text-left font-semibold">Vendor</TableHead>
                              </>
                            )}
                            {currentReport.id === 'full-statement' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-center font-semibold">Date</TableHead>
                                <TableHead className="text-left font-semibold">Transaction Type</TableHead>
                                <TableHead className="text-left font-semibold">Reference No.</TableHead>
                                <TableHead className="text-left font-semibold">Party Name</TableHead>
                                <TableHead className="text-left font-semibold">Description</TableHead>
                                <TableHead className="text-right font-semibold">Debit</TableHead>
                                <TableHead className="text-right font-semibold">Credit</TableHead>
                                <TableHead className="text-right font-semibold">Balance</TableHead>
                              </>
                            )}
                            {currentReport.id === 'expense-category-wise' && (
                              <>
                                <TableHead className="text-center font-semibold">S.No</TableHead>
                                <TableHead className="text-left font-semibold">Category</TableHead>
                                <TableHead className="text-center font-semibold">Expenses</TableHead>
                                <TableHead className="text-right font-semibold">Total Amount</TableHead>
                                <TableHead className="text-right font-semibold">Average</TableHead>
                                <TableHead className="text-right font-semibold">Minimum</TableHead>
                                <TableHead className="text-right font-semibold">Maximum</TableHead>
                                <TableHead className="text-right font-semibold">Cash</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map((row, index) => (
                            <TableRow key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <TableCell className="text-center font-medium">{index + 1}</TableCell>
                              
                              {currentReport.id === 'sales-report' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.invoice_number}</TableCell>
                                  <TableCell className="text-center">{new Date(row.invoice_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-left">{row.party_name || 'N/A'}</TableCell>
                                  <TableCell className="text-right font-medium">₹{row.total_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.discount_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">₹{row.net_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.paid_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.balance_amount?.toLocaleString()}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'purchase-report' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.invoice_number}</TableCell>
                                  <TableCell className="text-center">{new Date(row.invoice_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-left">{row.supplier_name || 'N/A'}</TableCell>
                                  <TableCell className="text-right font-medium">₹{row.total_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.discount_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold text-fatima-green">₹{row.net_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.paid_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.balance_amount?.toLocaleString()}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'day-book' && (
                                <>
                                  <TableCell className="text-center">{new Date(row.date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.type === 'Sale' ? 'bg-green-100 text-green-800' :
                                      row.type === 'Purchase' ? 'bg-green-100 text-blue-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {row.type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium text-left">{row.reference}</TableCell>
                                  <TableCell className="text-right text-red-600 font-medium">
                                    {row.flow === 'Debit' ? `₹${row.amount?.toLocaleString()}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">
                                    {row.flow === 'Credit' ? `₹${row.amount?.toLocaleString()}` : '-'}
                                  </TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'all-transactions' && (
                                <>
                                  <TableCell className="text-center">{new Date(row.date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.type === 'Sale' ? 'bg-green-100 text-green-800' :
                                      row.type === 'Purchase' ? 'bg-green-100 text-blue-800' :
                                      row.type === 'Payment' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {row.type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium text-left">{row.reference}</TableCell>
                                  <TableCell className="text-center">{row.party_type}</TableCell>
                                  <TableCell className="text-right text-red-600 font-medium">
                                    {row.flow === 'Debit' ? `₹${row.amount?.toLocaleString()}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">
                                    {row.flow === 'Credit' ? `₹${row.amount?.toLocaleString()}` : '-'}
                                  </TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'full-statement' && (
                                <>
                                  <TableCell className="text-center">{row.date}</TableCell>
                                  <TableCell className="text-left">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.transaction_type === 'Sales' ? 'bg-green-100 text-green-800' :
                                      row.transaction_type === 'Payment In' ? 'bg-purple-100 text-purple-800' :
                                      row.transaction_type === 'Payment Out' ? 'bg-red-100 text-red-800' :
                                      row.transaction_type === 'Expense' ? 'bg-orange-100 text-orange-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {row.transaction_type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium text-left">{row.reference}</TableCell>
                                  <TableCell className="text-left">{row.party_name}</TableCell>
                                  <TableCell className="text-left text-gray-600 text-sm">{row.description}</TableCell>
                                  <TableCell className="text-right text-red-600 font-medium">{row.debit}</TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">{row.credit}</TableCell>
                                  <TableCell className="text-right font-semibold">{row.balance}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'cash-flow' && (
                                <>
                                  <TableCell className="font-medium">{row.account_name}</TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.account_type === 'cash' ? 'bg-green-100 text-green-800' :
                                      row.account_type === 'bank' ? 'bg-green-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {row.account_type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">₹{row.opening_balance?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium">₹{row.current_balance?.toLocaleString()}</TableCell>
                                  <TableCell className={`text-right font-medium ${row.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{Math.abs(row.net_change)?.toLocaleString()}
                                  </TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'profit-loss' && (
                                <>
                                  <TableCell className={`${
                                    row.item_type === 'Revenue' ? 'font-bold text-green-700' :
                                    row.item_type === 'COGS' ? 'font-bold text-red-700' :
                                    row.item_type === 'Gross' ? 'font-bold text-blue-700 bg-green-50' :
                                    row.item_type === 'Net' ? 'font-bold text-purple-700 bg-purple-50' :
                                    row.item_type === 'Expenses' ? 'font-semibold text-gray-700 bg-gray-50' :
                                    row.item_type === 'Total Expenses' ? 'font-semibold text-orange-700' :
                                    'text-left'
                                  }`}>
                                    {row.item_name}
                                  </TableCell>
                                  <TableCell className={`text-right font-medium ${
                                    row.item_type === 'Revenue' ? 'text-green-600 font-bold' :
                                    row.item_type === 'COGS' ? 'text-red-600 font-bold' :
                                    row.item_type === 'Gross' ? 'text-fatima-green font-bold bg-green-50' :
                                    row.item_type === 'Net' ? 'text-purple-600 font-bold bg-purple-50' :
                                    row.item_type === 'Expenses' ? 'text-gray-600 bg-gray-50' :
                                    row.item_type === 'Total Expenses' ? 'text-orange-600 font-bold' :
                                    row.amount > 0 ? 'text-red-600' : 'text-gray-500'
                                  }`}>
                                    {row.item_type === 'Expenses' ? '' : `₹${Math.abs(row.amount)?.toLocaleString()}`}
                                  </TableCell>
                                </>
                              )}
                              
                              
                              {currentReport.id === 'party-statement' && (
                                <>
                                  <TableCell className="font-medium">{row.party_name}</TableCell>
                                  <TableCell className="text-right">₹{row.opening_balance?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium">₹{row.current_balance?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.total_sales?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{row.invoice_count}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'all-parties' && (
                                <>
                                  <TableCell className="font-medium">{row.party_name}</TableCell>
                                  <TableCell>{row.phone || '-'}</TableCell>
                                  <TableCell className="text-right font-medium">₹{row.current_balance?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.lifetime_sales?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{row.total_invoices}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'party-profit-loss' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.party_name}</TableCell>
                                  <TableCell className="text-center font-medium">{row.total_invoices}</TableCell>
                                  <TableCell className="text-right">₹{row.total_sales?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-orange-600">₹{row.total_discounts?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">₹{row.net_sales?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.avg_invoice_value?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium text-fatima-green">₹{row.outstanding_balance?.toLocaleString()}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'stock-summary' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.item_name}</TableCell>
                                  <TableCell className="text-right font-medium">{row.current_stock}</TableCell>
                                  <TableCell className="text-center">{row.unit}</TableCell>
                                  <TableCell className="text-right">₹{row.purchase_rate?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.sale_rate?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold text-fatima-green">₹{row.stock_value?.toLocaleString()}</TableCell>
                                  <TableCell className={`text-right font-semibold ${row.margin_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {row.margin_percentage?.toFixed(1)}%
                                  </TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'item-profit-loss' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.item_name}</TableCell>
                                  <TableCell className="text-right font-medium">{row.current_stock}</TableCell>
                                  <TableCell className="text-right">₹{row.purchase_price?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.sale_price?.toLocaleString()}</TableCell>
                                  <TableCell className={`text-right font-semibold ${row.profit_per_unit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{row.profit_per_unit?.toLocaleString()}
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${row.profit_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {row.profit_margin_percent?.toFixed(1)}%
                                  </TableCell>
                                  <TableCell className={`text-right font-bold ${row.potential_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{row.potential_profit?.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.stock_status === 'Low Stock' ? 'bg-red-100 text-red-800' :
                                      row.stock_status === 'Overstock' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {row.stock_status}
                                    </span>
                                  </TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'expense-report' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.expense_number}</TableCell>
                                  <TableCell className="text-center">{new Date(row.expense_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-left">
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                                      {row.category_name || 'Uncategorized'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-left">{row.description}</TableCell>
                                  <TableCell className="text-right font-semibold text-red-600">₹{row.amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      row.payment_mode === 'cash' ? 'bg-green-100 text-green-800' :
                                      row.payment_mode === 'card' ? 'bg-green-100 text-blue-800' :
                                      row.payment_mode === 'cheque' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {row.payment_mode}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-left">{row.vendor_name || '-'}</TableCell>
                                </>
                              )}
                              
                              {currentReport.id === 'expense-category-wise' && (
                                <>
                                  <TableCell className="font-medium text-left">{row.category_name}</TableCell>
                                  <TableCell className="text-center font-medium">{row.expense_count}</TableCell>
                                  <TableCell className="text-right font-semibold text-red-600">₹{row.total_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.average_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.min_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₹{row.max_amount?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium text-green-600">₹{row.cash_amount?.toLocaleString()}</TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <currentReport.icon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Data Found</h3>
                    <p className="text-gray-500">
                      No {currentReport.title.toLowerCase()} data found for the selected date range.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessReports;