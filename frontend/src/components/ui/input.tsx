import { cn } from '@/lib/utils';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
            icon && 'pl-10',
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-indigo-400',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
