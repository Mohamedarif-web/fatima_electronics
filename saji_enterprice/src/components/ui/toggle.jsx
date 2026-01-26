import React from 'react'
import { cn } from '../../lib/utils'

export const Toggle = React.forwardRef(({ pressed, onPressedChange, className, children, ...props }, ref) => {
  const isOn = !!pressed
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={isOn}
      onClick={() => onPressedChange && onPressedChange(!isOn)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors',
        isOn
          ? 'border-fatima-green bg-fatima-green text-white hover:bg-fatima-green/90'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
Toggle.displayName = 'Toggle'
