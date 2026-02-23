import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, size = 'md', variant = 'default', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-4 py-4 text-base',
    };

    const variantStyles = {
      default: 'bg-lol-dark border border-lol-border rounded-xl focus:border-lol-gold/50 focus:ring-2 focus:ring-lol-gold/20 hover:border-lol-border-light',
      minimal: 'bg-transparent border-b border-lol-border/50 rounded-none focus:border-lol-gold/50 focus:ring-0 hover:border-lol-border',
    };

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            ${sizeStyles[size]}
            ${variantStyles[variant]}
            text-white placeholder-gray-500
            transition-all duration-200
            focus:outline-none
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
