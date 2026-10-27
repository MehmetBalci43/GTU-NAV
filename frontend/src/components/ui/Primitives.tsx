import React from 'react';
import { Loader2 } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                TACTILE BUTTON                              */
/* -------------------------------------------------------------------------- */

export interface TactileButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-extrabold select-none transition-all duration-75 text-center cursor-pointer border-2 border-zinc-950 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'min-h-[36px] sm:min-h-[32px] px-3 py-1 text-xs rounded-xl shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
    md: 'min-h-[44px] px-4 py-2 text-xs sm:text-sm rounded-xl shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18181B]',
    lg: 'min-h-[50px] px-5 py-2.5 text-sm sm:text-base rounded-2xl shadow-hard-md active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18181B]',
  };

  const variantStyles = {
    primary:
      'bg-emerald-400 hover:bg-emerald-300 text-zinc-950 shadow-hard',
    secondary:
      'bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-hard',
    accent:
      'bg-sky-400 hover:bg-sky-300 text-zinc-950 shadow-hard',
    warning:
      'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-hard',
    danger:
      'bg-rose-500 hover:bg-rose-400 text-white shadow-hard',
    neutral:
      'bg-zinc-900 dark:bg-zinc-950 hover:bg-zinc-800 text-zinc-100 shadow-hard',
    ghost:
      'border-transparent shadow-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 active:translate-x-0 active:translate-y-0',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" />
      ) : icon ? (
        <span className="mr-2 shrink-0 inline-flex items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/*                             TACTILE ICON BUTTON                            */
/* -------------------------------------------------------------------------- */

export interface TactileIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'warning' | 'danger' | 'neutral' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

export const TactileIconButton: React.FC<TactileIconButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  label,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg shadow-hard-sm text-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
    md: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl shadow-hard text-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18181B]',
    lg: 'w-13 h-13 min-w-[50px] min-h-[50px] rounded-2xl shadow-hard-md text-base active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#18181B]',
  };

  const variantStyles = {
    primary: 'bg-emerald-400 hover:bg-emerald-300 text-zinc-950 border-2 border-zinc-950',
    secondary:
      'bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-2 border-zinc-950',
    accent: 'bg-sky-400 hover:bg-sky-300 text-zinc-950 border-2 border-zinc-950',
    warning: 'bg-amber-400 hover:bg-amber-300 text-zinc-950 border-2 border-zinc-950',
    danger: 'bg-rose-500 hover:bg-rose-400 text-white border-2 border-zinc-950',
    neutral: 'bg-zinc-900 dark:bg-zinc-950 hover:bg-zinc-800 text-zinc-100 border-2 border-zinc-950',
    ghost:
      'border-transparent shadow-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 active:translate-x-0 active:translate-y-0',
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center font-extrabold select-none transition-all duration-75 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/*                                TACTILE CARD                                */
/* -------------------------------------------------------------------------- */

export interface TactileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TactileCard: React.FC<TactileCardProps> = ({
  children,
  className = '',
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard rounded-2xl p-4 text-zinc-900 dark:text-zinc-100 transition-colors ${className}`}
  >
    {children}
  </div>
);

export const SurfaceCard: React.FC<TactileCardProps> = TactileCard;

/* -------------------------------------------------------------------------- */
/*                                STATUS BADGE                                */
/* -------------------------------------------------------------------------- */

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'rose' | 'amber' | 'sky' | 'purple' | 'slate' | 'mint';
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  icon,
  className = '',
}) => {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-950 border-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700',
    rose: 'bg-rose-100 text-rose-950 border-rose-950 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700',
    amber: 'bg-amber-100 text-amber-950 border-amber-950 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
    sky: 'bg-sky-100 text-sky-950 border-sky-950 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-700',
    purple: 'bg-purple-100 text-purple-950 border-purple-950 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700',
    slate: 'bg-zinc-100 text-zinc-900 border-zinc-950 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600',
    mint: 'bg-emerald-200 text-emerald-950 border-zinc-950 dark:bg-emerald-900 dark:text-emerald-100 dark:border-zinc-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black border border-zinc-950 shadow-hard-sm tabular-nums select-none ${styles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*                             BOTTOM SHEET GRABBER                           */
/* -------------------------------------------------------------------------- */

export const GrabberHandle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-full flex justify-center py-2.5 cursor-grab active:cursor-grabbing ${className}`}>
    <div className="w-10 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 border border-zinc-950 transition-colors" />
  </div>
);

/* -------------------------------------------------------------------------- */
/*                               CAMPUS SEARCH FIELD                          */
/* -------------------------------------------------------------------------- */

export interface CampusSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const CampusSearchField: React.FC<CampusSearchFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Ders kodu (CSE 101), amfi veya bina ara...',
  className = '',
  autoFocus = false,
}) => {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-11 pl-10 pr-9 bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-sky-400 shadow-hard-sm transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
          aria-label="Aramayı Temizle"
        >
          ✕
        </button>
      )}
    </div>
  );
};
