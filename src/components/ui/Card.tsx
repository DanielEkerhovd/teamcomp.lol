import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'glass' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', hover = false, children, ...props }, ref) => {
    const baseStyles = 'rounded-xl transition-all duration-200';

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    };

    const variants = {
      default: 'bg-lol-card border border-lol-border/50',
      bordered: 'bg-lol-card border border-lol-border',
      glass: 'bg-glass backdrop-blur-md border border-glass-border',
      elevated: 'bg-lol-card border border-lol-border/50 shadow-lg shadow-black/20',
    };

    const hoverStyles = hover
      ? 'hover:bg-lol-card-hover hover:border-lol-border-light hover:shadow-lg hover:shadow-black/30 cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${paddingStyles[padding]} ${variants[variant]} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
