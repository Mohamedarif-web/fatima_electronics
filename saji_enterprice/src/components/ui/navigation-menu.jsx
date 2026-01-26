import React from 'react'
import { cn } from '../../lib/utils'

export function NavigationMenu({ className, children }) {
  return <nav className={cn('flex flex-col gap-1', className)}>{children}</nav>
}

export function NavigationMenuItem({ active, className, icon: Icon, children, ...props }) {
  return (
    <button
      className={cn(
        'flex items-center gap-3.5 rounded-md px-4 py-3 text-base font-medium transition-colors w-full text-left',
        active
          ? 'bg-saji-brown text-white'
          : 'text-white/80 hover:bg-fatima-green/80 hover:text-white',
        className
      )}
      {...props}
    >
      {Icon && <Icon size={20} />}
      <span>{children}</span>
    </button>
  )
}
