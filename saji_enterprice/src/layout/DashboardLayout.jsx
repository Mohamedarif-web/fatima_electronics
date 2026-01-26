import React from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import CustomTitlebar from '../components/CustomTitlebar'

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const [route, setRoute] = React.useState('dashboard')

  // Update route based on current URL path
  React.useEffect(() => {
    const path = location.pathname
    console.log('🔍 DashboardLayout - Current path:', path);
    console.log('🔍 DashboardLayout - Current hash:', window.location.hash);
    
    if (path === '/' || path === '/dashboard') {
      console.log('🎯 Setting route to: dashboard');
      setRoute('dashboard')
    } else if (path === '/items') {
      console.log('🎯 Setting route to: items');
      setRoute('items')
    } else if (path === '/parties') {
      console.log('🎯 Setting route to: parties');
      setRoute('parties')
    } else if (path === '/suppliers') {
      console.log('🎯 Setting route to: suppliers');
      setRoute('suppliers')
    } else if (path.startsWith('/sales')) {
      console.log('🎯 Setting route to: sales');
      setRoute('sales')
    } else if (path.startsWith('/purchase')) {
      console.log('🎯 Setting route to: purchase');
      setRoute('purchase')
    } else if (path.startsWith('/payments')) {
      console.log('🎯 Setting route to: payments');
      setRoute('payments')
    } else if (path === '/expenses') {
      console.log('🎯 Setting route to: expenses');
      setRoute('expenses')
    } else if (path === '/bank') {
      console.log('🎯 Setting route to: bank');
      setRoute('bank')
    } else if (path === '/reports') {
      console.log('🎯 Setting route to: reports');
      setRoute('reports')
    } else {
      console.log('⚠️ Unknown path, defaulting to dashboard');
      setRoute('dashboard')
    }
  }, [location.pathname])

  return (
    <div className="flex w-screen h-screen bg-background text-foreground overflow-hidden m-0 p-0">
      <Sidebar current={route} onNavigate={setRoute} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CustomTitlebar />
        <main className="flex-1 overflow-auto p-4 w-full h-full">{children}</main>
      </div>
    </div>
  )
}
