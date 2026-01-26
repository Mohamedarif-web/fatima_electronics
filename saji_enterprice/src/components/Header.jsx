import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Bell, Package, AlertTriangle, X } from 'lucide-react'
import db from '../utils/database'

export default function Header() {
  const [lowStockItems, setLowStockItems] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadLowStockItems()
  }, [])

  const loadLowStockItems = async () => {
    try {
      setLoading(true)
      const items = await db.query(`
        SELECT 
          product_name,
          current_stock,
          min_stock,
          unit
        FROM items 
        WHERE is_deleted = 0 
        AND current_stock <= min_stock 
        AND min_stock > 0
        ORDER BY (current_stock - min_stock) ASC
      `)
      setLowStockItems(items)
    } catch (error) {
      console.error('Error loading low stock items:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header
        className="app-drag flex items-center justify-between border-b bg-white px-4 py-2 relative"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
      >
        <div className="font-medium text-gray-800 app-no-drag">Dashboard</div>
        <div className="flex items-center gap-2 app-no-drag">
          {/* Notification Bell */}
          <div className="relative">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <Bell className="w-4 h-4" />
              {lowStockItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {lowStockItems.length}
                </span>
              )}
            </Button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-sm">Low Stock Alert</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNotifications(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Loading...
                    </div>
                  ) : lowStockItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      <Package className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      All items are in stock!
                    </div>
                  ) : (
                    lowStockItems.map((item, index) => (
                      <div key={index} className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Current: {item.current_stock} {item.unit} | Min: {item.min_stock} {item.unit}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            item.current_stock === 0 
                              ? 'bg-red-100 text-red-800' 
                              : item.current_stock < item.min_stock * 0.5
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.current_stock === 0 
                              ? 'Out of Stock' 
                              : item.current_stock < item.min_stock * 0.5
                              ? 'Critical Low'
                              : 'Low Stock'
                            }
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {lowStockItems.length > 0 && (
                  <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600 text-center">
                      {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need{lowStockItems.length === 1 ? 's' : ''} restocking
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="secondary">New</Button>
        </div>
      </header>

      {/* Overlay to close notifications when clicking outside */}
      {showNotifications && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </>
  )
}
