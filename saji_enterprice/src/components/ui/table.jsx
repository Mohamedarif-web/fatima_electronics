import React from 'react'
import { cn } from '../../lib/utils'

export function Table({ className, ...props }) {
  return <table className={cn('w-full text-sm text-left border-collapse', className)} {...props} />
}
export function TableHeader({ className, ...props }) {
  return <thead className={cn('bg-neutral-50 dark:bg-neutral-900', className)} {...props} />
}
export function TableBody({ className, ...props }) {
  return <tbody className={cn('', className)} {...props} />
}
export function TableRow({ className, ...props }) {
  return <tr className={cn('border-b border-border hover:bg-neutral-50 dark:hover:bg-neutral-900/60', className)} {...props} />
}
export function TableHead({ className, ...props }) {
  return <th className={cn('px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-300', className)} {...props} />
}
export function TableCell({ className, ...props }) {
  return <td className={cn('px-4 py-2 text-neutral-800 dark:text-neutral-200', className)} {...props} />
}
