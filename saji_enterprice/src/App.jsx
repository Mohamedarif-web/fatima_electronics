import React, { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Simple Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('❌ SupplierMaster Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <div>❌ Error loading Suppliers component</div>;
    }
    return this.props.children;
  }
}
import DashboardLayout from './layout/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ItemMaster from './pages/Items/ItemMaster'
import PartyMaster from './pages/Parties/PartyMaster'
import SupplierMaster from './pages/Suppliers/SupplierMaster'
import SalesModule from './pages/Sales'
import PurchaseModule from './pages/Purchase'
import PaymentsModule from './pages/Payments'
import ExpenseTracker from './pages/Expenses/ExpenseTracker'
import BankCash from './pages/Bank/BankCash'
import BusinessReports from './pages/Reports/BusinessReports'
import { AuthProvider, useAuth } from './context/AuthContext'
import './App.css'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  // Temporarily bypass login for testing
  // if (!isAuthenticated) {
  //   return <Login />
  // }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/items" element={<ItemMaster />} />
        <Route path="/parties" element={<PartyMaster />} />
        <Route path="/suppliers" element={
          <div>
            {console.log('🎯 SUPPLIERS ROUTE MATCHED!')}
            <ErrorBoundary>
              <SupplierMaster />
            </ErrorBoundary>
          </div>
        } />
        {/* Sales Routes */}
        <Route path="/sales/*" element={<SalesModule />} />
        {/* Purchase Routes */}
        <Route path="/purchase/*" element={<PurchaseModule />} />
        {/* Payment Routes */}
        <Route path="/payments/*" element={<PaymentsModule />} />
        {/* Reports Routes */}
        <Route path="/reports" element={<BusinessReports />} />
        {/* Other Routes */}
        <Route path="/expenses" element={<ExpenseTracker />} />
        <Route path="/bank" element={<BankCash />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App