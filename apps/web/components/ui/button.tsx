import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-[#EDEDED] text-black hover:opacity-90': variant === 'default',
            'hover:bg-[#1C1C1E] text-[#888] hover:text-[#EDEDED]':
              variant === 'ghost',
            'bg-[#EF4444] text-white hover:opacity-90': variant === 'danger',
            'text-[#888] hover:text-[#EDEDED] hover:bg-[#1C1C1E]':
              variant === 'icon',
          },
          {
            'h-10 px-4 text-sm': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-12 px-6 text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
