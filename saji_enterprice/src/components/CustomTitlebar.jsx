import React, { useState, useEffect } from 'react'
import { Bell, Package, AlertTriangle, X, ExternalLink } from 'lucide-react'
import { Button } from './ui/button'
import { useNavigate } from 'react-router-dom'
import db from '../utils/database'

export default function CustomTitlebar() {
  const [lowStockItems, setLowStockItems] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    console.log('🔔 NOTIFICATION DEBUG: CustomTitlebar mounted, initializing notifications...')
    loadLowStockItems()
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      console.log('🔔 NOTIFICATION DEBUG: Periodic check running...')
      loadLowStockItems()
    }, 30 * 1000)
    return () => {
      console.log('🔔 NOTIFICATION DEBUG: CustomTitlebar unmounting, clearing interval')
      clearInterval(interval)
    }
  }, [])

  // Also refresh when notification panel is opened
  useEffect(() => {
    if (showNotifications) {
      loadLowStockItems()
    }
  }, [showNotifications])

  const loadLowStockItems = async () => {
    try {
      setLoading(true)
      console.log('🔔 NOTIFICATION DEBUG: Loading low stock items...')
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
      console.log('🔔 NOTIFICATION DEBUG: Low stock items found:', items)
      console.log('🔔 NOTIFICATION DEBUG: Total low stock items:', items.length)
      console.log('🔔 NOTIFICATION DEBUG: Setting state with items:', items)
      setLowStockItems(items)
      
      // Force re-render by logging state after update
      setTimeout(() => {
        console.log('🔔 NOTIFICATION DEBUG: State should be updated. Current lowStockItems length:', items.length)
      }, 100)
    } catch (error) {
      console.error('🔔 NOTIFICATION DEBUG: Error loading low stock items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = (item) => {
    // Close notification panel
    setShowNotifications(false)
    // Navigate to Items page
    navigate('/items')
    // Optional: You can add a URL parameter to highlight the specific item
    // navigate(`/items?highlight=${encodeURIComponent(item.product_name)}`)
  }

  return (
    <>
      <div
        className="app-drag w-full h-16 flex items-center justify-between px-6 select-none border-b border-border bg-background"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
      >
        <div className="font-bold text-base md:text-lg text-foreground/90 app-no-drag">
          
        </div>
        
        {/* Notification Bell */}
        <div className="relative app-no-drag">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setShowNotifications(!showNotifications)
              // Refresh data when opening notifications
              if (!showNotifications) {
                loadLowStockItems()
              }
            }}
            className="relative"
          >
            <Bell className="w-4 h-4" />
            {lowStockItems.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center animate-pulse">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      loadLowStockItems()
                    }}
                    className="h-6 w-6 p-0 ml-2"
                    title="Refresh"
                  >
                    <Bell className="w-3 h-3" />
                  </Button>
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
                    <div 
                      key={index} 
                      className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors group"
                      onClick={() => handleItemClick(item)}
                      title="Click to go to Items page"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700 flex items-center gap-2">
                            {item.product_name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
      </div>

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
