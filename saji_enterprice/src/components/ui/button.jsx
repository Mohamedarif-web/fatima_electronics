import React from 'react'
import { cn } from '../../lib/utils'

export const Button = React.forwardRef(({ className, variant = 'default', size = 'md', ...props }, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background select-none'
  const variants = {
    default: 'bg-fatima-green text-white hover:bg-fatima-green/90 dark:bg-fatima-green dark:hover:bg-fatima-green/90',
    outline: 'border border-neutral-300 bg-transparent text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800',
    ghost: 'bg-transparent text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
  }
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-5 text-base',
    lg: 'h-11 px-6 text-base',
  }
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  )
})
Button.displayName = 'Button'
