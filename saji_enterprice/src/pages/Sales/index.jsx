import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SalesList from './SalesList';
import SalesInvoice from './SalesInvoice';
import GSTInvoicePage from './GSTInvoicePage';

const SalesModule = () => {
  return (
    <Routes>
      <Route path="/" element={<SalesList />} />
      <Route path="/list" element={<SalesList />} />
      <Route path="/invoice" element={<SalesInvoice />} />
      <Route path="/bill" element={<SalesInvoice />} />
      <Route path="/gst-invoice" element={<GSTInvoicePage />} />
      <Route path="*" element={<Navigate to="/sales" replace />} />
    </Routes>
  );
};

export default SalesModule;