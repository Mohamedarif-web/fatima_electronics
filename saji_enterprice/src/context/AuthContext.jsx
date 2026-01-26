import React, { createContext, useContext, useState, useEffect } from 'react'
import authService from '../utils/auth'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const user = await authService.login(username, password)
      if (user) {
        setUser(user)
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const isAuthenticated = !!user

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated,
      isAdmin: () => authService.isAdmin()
    }}>
      {children}
    </AuthContext.Provider>
  )
}