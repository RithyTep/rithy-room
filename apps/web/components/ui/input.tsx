import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-[#EDEDED] placeholder-[#555] focus:outline-none focus:border-[#6E56CF] transition-colors',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
