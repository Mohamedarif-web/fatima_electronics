import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PurchaseList from './PurchaseList';
import PurchaseInvoice from './PurchaseInvoice';

const PurchaseModule = () => {
  return (
    <Routes>
      <Route path="/" element={<PurchaseList />} />
      <Route path="/list" element={<PurchaseList />} />
      <Route path="/bill" element={<PurchaseInvoice />} />
      <Route path="/bill/:purchaseId" element={<PurchaseInvoice />} />
      <Route path="*" element={<Navigate to="/purchase" replace />} />
    </Routes>
  );
};

export default PurchaseModule;