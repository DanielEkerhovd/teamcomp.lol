import { HTMLAttributes, forwardRef } from 'react';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const Tag = forwardRef<HTMLSpanElement, TagProps>(
  ({ className = '', variant = 'default', size = 'md', removable, onRemove, children, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1.5 text-sm',
    };

    const baseStyles = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors ${sizeStyles[size]}`;

    const variants = {
      default: 'bg-lol-surface text-gray-300 border border-lol-border',
      primary: 'bg-lol-gold/15 text-lol-gold border border-lol-gold/30',
      success: 'bg-green-500/15 text-green-400 border border-green-500/30',
      warning: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
      danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 -mr-1 hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Tag.displayName = 'Tag';

export default Tag;
