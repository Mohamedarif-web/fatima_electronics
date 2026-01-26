import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Home, 
  Package,
  Users,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Receipt,
  Wallet,
  BarChart3,
  Truck,
  User
} from 'lucide-react'
import { NavigationMenu } from './ui/navigation-menu'

export default function Sidebar({ current = 'dashboard', onNavigate }) {
  const navigate = useNavigate()

  const navigation = [
    { 
      name: 'Home', 
      href: '#/dashboard', 
      icon: Home, 
      current: current === 'dashboard',
      description: 'Overview'
    },
    { 
      name: 'Items', 
      href: '#/items', 
      icon: Package, 
      current: current === 'items',
      description: 'Item Master'
    },
    { 
      name: 'Parties', 
      href: '#/parties', 
      icon: Users, 
      current: current === 'parties',
      description: 'Customers & Suppliers'
    },
    { 
      name: 'Suppliers', 
      href: '#/suppliers', 
      icon: Truck, 
      current: current === 'suppliers',
      description: 'Supplier Management'
    },
    { 
      name: 'Sales', 
      href: '#/sales', 
      icon: TrendingUp, 
      current: current === 'sales',
      description: 'Sales Invoices'
    },
    { 
      name: 'Purchase', 
      href: '#/purchase', 
      icon: ShoppingCart, 
      current: current === 'purchase',
      description: 'Purchase Bills'
    },
    { 
      name: 'Payments', 
      href: '#/payments', 
      icon: CreditCard, 
      current: current === 'payments',
      description: 'Payment In/Out'
    },
    { 
      name: 'Expenses', 
      href: '#/expenses', 
      icon: Receipt, 
      current: current === 'expenses',
      description: 'Business Expenses'
    },
    { 
      name: 'Bank & Cash', 
      href: '#/bank', 
      icon: Wallet, 
      current: current === 'bank',
      description: 'Accounts'
    },
    { 
      name: 'Reports', 
      href: '#/reports', 
      icon: BarChart3, 
      current: current === 'reports',
      description: 'Business Reports'
    },
  ]

  return (
    <aside className="h-full w-72 shrink-0 border-r border-gray-200 bg-white p-4 flex flex-col">
      {/* Logo Header */}
      <div className="mb-3 px-2 py-3 flex justify-center border-b border-gray-100">
        <div className="text-center">
          <div className="text-xl font-bold text-fatima-green mb-1">
            FATIMA
          </div>
          <div className="text-sm font-semibold text-gray-700 -mt-1">
            ELECTRONICS
          </div>
          <div className="w-12 h-0.5 bg-fatima-green mx-auto mt-1"></div>
        </div>
      </div>

      {/* Navigation Menu - Scrollable */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="space-y-1 pr-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.name}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('🔍 Sidebar click:', item.name, 'href:', item.href);
                  
                  // Use React Router navigate
                  const path = item.href.substring(1); // Remove #
                  console.log('🔍 Navigating to path:', path);
                  navigate(path);
                  
                  onNavigate?.(item.name.toLowerCase());
                }}
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                  item.current
                    ? 'bg-fatima-green text-white font-bold'
                    : 'text-gray-600 hover:bg-fatima-green/10 hover:text-fatima-green font-medium'
                }`}
              >
                <Icon className="mr-2.5 h-5 w-5 flex-shrink-0" />
                <span className="text-sm truncate">{item.name}</span>
              </a>
            )
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="mt-2 px-2 pt-3 border-t border-gray-200 text-sm text-gray-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-fatima-green flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-gray-800 text-sm">Admin User</div>
            <div className="text-xs text-gray-500">Administrator</div>
          </div>
        </div>
      </div>
    </aside>
  )
}