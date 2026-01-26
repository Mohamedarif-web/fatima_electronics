import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PaymentIn from './PaymentIn';
import PaymentOut from './PaymentOut';
import PaymentHistory from './PaymentHistory';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TrendingDown, TrendingUp, ArrowRight, Wallet, CreditCard, Building2, BarChart3, Calendar, TrendingUp as TrendingUpIcon, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import db from '../../utils/database';

const PaymentsOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayCollections: 0,
    todayPayments: 0,
    netCashFlow: 0,
    loading: true
  });

  useEffect(() => {
    loadPaymentStats();
  }, []);

  const loadPaymentStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's payment collections (payment_in)
      const collections = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_collections
        FROM payments 
        WHERE payment_type = 'payment_in' 
        AND payment_date = ? 
        AND is_deleted = 0
      `, [today]);

      // Get today's payment outflows (payment_out)
      const payments = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_payments
        FROM payments 
        WHERE payment_type = 'payment_out' 
        AND payment_date = ? 
        AND is_deleted = 0
      `, [today]);

      const todayCollections = collections[0]?.total_collections || 0;
      const todayPayments = payments[0]?.total_payments || 0;
      const netCashFlow = todayCollections - todayPayments;

      setStats({
        todayCollections,
        todayPayments,
        netCashFlow,
        loading: false
      });

      console.log('📊 Payment Stats:', { todayCollections, todayPayments, netCashFlow });
    } catch (error) {
      console.error('Error loading payment stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
      </div>

      {/* Top Row - Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {stats.loading ? '...' : `₹${stats.todayCollections.toLocaleString()}`}
            </div>
            <div className="text-sm text-muted-foreground">Today's Collections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {stats.loading ? '...' : `₹${stats.todayPayments.toLocaleString()}`}
            </div>
            <div className="text-sm text-muted-foreground">Today's Payments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className={`text-2xl font-bold mb-1 ${stats.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.loading ? '...' : `₹${stats.netCashFlow.toLocaleString()}`}
            </div>
            <div className="text-sm text-muted-foreground">Net Cash Flow</div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/payments/in')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Payment In</CardTitle>
            <TrendingUp className="h-6 w-6 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600 mb-2">Customer Payments</div>
            <p className="text-sm text-muted-foreground mb-4">
              Record payments received from customers.
            </p>
            <Button className="w-full bg-fatima-green hover:bg-fatima-green">
              Record Payment In
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/payments/out')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Payment Out</CardTitle>
            <TrendingDown className="h-6 w-6 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600 mb-2">Supplier Payments</div>
            <p className="text-sm text-muted-foreground mb-4">
              Record payments made to suppliers.
            </p>
            <Button className="w-full bg-fatima-green hover:bg-fatima-green">
              Record Payment Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const PaymentsModule = () => {
  return (
    <Routes>
      <Route path="/" element={<PaymentsOverview />} />
      <Route path="/in" element={<PaymentIn />} />
      <Route path="/out" element={<PaymentOut />} />
      <Route path="*" element={<Navigate to="/payments" replace />} />
    </Routes>
  );
};

export default PaymentsModule;