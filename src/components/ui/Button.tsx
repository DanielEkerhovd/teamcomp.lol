import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center
      font-semibold rounded-xl transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-lol-dark
      disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
      active:scale-[0.98]
    `;

    const variants = {
      primary: `
        bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark
        hover:from-lol-gold hover:to-lol-gold-dark hover:shadow-lg hover:shadow-lol-gold/20
        focus:ring-lol-gold
      `,
      secondary: `
        bg-lol-surface text-gray-100 border border-lol-border
        hover:bg-lol-card-hover hover:border-lol-border-light hover:text-white
        focus:ring-lol-border
      `,
      danger: `
        bg-gradient-to-b from-red-500 to-red-600 text-white
        hover:from-red-400 hover:to-red-500 hover:shadow-lg hover:shadow-red-500/20
        focus:ring-red-500
      `,
      ghost: `
        bg-transparent text-gray-400
        hover:bg-lol-surface hover:text-white
        focus:ring-lol-border
      `,
      outline: `
        bg-transparent text-lol-gold border border-lol-gold/50
        hover:bg-lol-gold/10 hover:border-lol-gold
        focus:ring-lol-gold
      `,
    };

    const sizes = {
      sm: 'px-3.5 py-2 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
