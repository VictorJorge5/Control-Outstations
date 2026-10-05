import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(200_16_46/0.3)] hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 shadow-xs hover:bg-ink-50 hover:ring-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  dark: 'bg-ink-900 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-ink-800',
  danger: 'bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50',
  subtle: 'bg-ink-100 text-ink-700 hover:bg-ink-150',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'size-9.5 rounded-[10px]',
  'icon-sm': 'size-8 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...props }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.97]',
        'disabled:opacity-45 disabled:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : icon}
      {children}
    </button>
  );
});
