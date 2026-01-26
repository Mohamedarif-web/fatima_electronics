import React from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, variant = 'default', ...props }) {
  const base = 'rounded-lg border shadow-sm'
  const variants = {
    default: 'border-border bg-white dark:bg-neutral-900 text-foreground',
    accent: 'border-transparent bg-gradient-to-br from-saji-brown/10 to-saji-brown/20 text-fatima-green dark:from-saji-brown/20 dark:to-saji-brown/30 dark:text-white',
  }
  return <div className={cn(base, variants[variant] || variants.default, className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-bold leading-none tracking-tight', className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}
