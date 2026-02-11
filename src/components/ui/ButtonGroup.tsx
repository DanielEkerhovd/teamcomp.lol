interface ButtonGroupOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ButtonGroupProps {
  options: ButtonGroupOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export default function ButtonGroup({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth = false,
}: ButtonGroupProps) {
  const sizeStyles = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-sm',
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-300">{label}</label>
      )}
      <div
        className={`
          inline-flex rounded-xl bg-lol-dark p-1.5 gap-1.5 border border-lol-border
          ${fullWidth ? 'w-full' : ''}
        `}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`
                ${sizeStyles[size]}
                ${fullWidth ? 'flex-1' : ''}
                rounded-lg font-medium transition-all duration-200
                ${
                  isSelected
                    ? 'bg-gradient-to-b from-lol-gold-light to-lol-gold text-lol-dark shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-lol-surface'
                }
              `}
            >
              <div>{option.label}</div>
              {option.sublabel && (
                <div
                  className={`text-xs mt-0.5 ${
                    isSelected ? 'text-lol-dark/70' : 'text-gray-500'
                  }`}
                >
                  {option.sublabel}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
