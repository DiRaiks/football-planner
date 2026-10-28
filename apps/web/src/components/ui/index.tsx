import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { CircleNotch } from '@phosphor-icons/react';

export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

// Interactive states share one recipe: explicit transition properties, tactile press
const pressable =
  'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};

const variants = {
  primary: 'bg-accent text-accent-ink hover:brightness-95 shadow-panel',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'text-danger hover:bg-danger-soft',
};

export const buttonClass = ({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: keyof typeof variants;
  size?: 'md' | 'lg';
  className?: string;
} = {}) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap',
    size === 'lg' ? 'h-13 px-6 text-base' : 'h-11 px-4 text-[15px]',
    variants[variant],
    pressable,
    className,
  );

/** A link that looks like a button, e.g. "Новый матч" */
export function ButtonLink({
  to,
  variant,
  size,
  icon,
  className,
  children,
}: {
  to: string;
  variant?: keyof typeof variants;
  size?: 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={buttonClass({ variant, size, className })}>
      {icon}
      {children}
    </Link>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <CircleNotch className="size-5 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink',
        pressable,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Label above, hint or error below; never a placeholder as the label */
export function Field({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 rounded-control border bg-surface px-3.5 text-base text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70',
          'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30',
          error ? 'border-danger' : 'border-line',
        )}
        {...props}
      />
      {(error || hint) && (
        <p
          id={describedBy}
          className={cn('text-sm', error ? 'text-danger' : 'text-muted')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

/**
 * Two or three mutually exclusive options, e.g. "Иду" / "Возможно".
 * Follows the ARIA radio group pattern: one tab stop, arrow keys move and select.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T | null;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusable = selectedIndex === -1 ? 0 : selectedIndex;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next = (focusable + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    refs.current[next]?.focus();
    onChange(option.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'grid auto-cols-fr grid-flow-col gap-1 rounded-control bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusable ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              // One line with room around the label: a wrapped or edge-to-edge label
              // looks broken in the selected pill
              'inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-3 text-sm font-medium whitespace-nowrap',
              pressable,
              selected
                ? 'bg-accent-soft text-ink shadow-panel ring-1 ring-accent/40'
                : 'text-muted hover:text-ink',
            )}
          >
            {/* On a phone three labels with icons do not fit in one line */}
            {option.icon && (
              <span className="hidden sm:inline-flex">{option.icon}</span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-control bg-surface-2', className)}
    />
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <div className="text-muted">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <p className="max-w-[40ch] text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
    >
      {children}
    </p>
  );
}

/**
 * A Telegram profile photo, or `fallback` when there is none or it does not load (Telegram
 * can be slow or blocked for some people)
 */
export function ProfilePhoto({
  src,
  alt = '',
  className,
  fallback,
}: {
  src?: string;
  alt?: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={cn(
        'shrink-0 object-cover outline outline-ink/10 -outline-offset-1',
        className,
      )}
    />
  );
}

/** The photo, else initials in a rounded square; people stay easy to tell apart */
export function Avatar({
  name,
  photoUrl,
  muted = false,
}: {
  name: string;
  photoUrl?: string;
  muted?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <ProfilePhoto
      src={photoUrl}
      className={cn('size-9 rounded-[10px]', muted && 'opacity-60')}
      fallback={<Initials initials={initials} muted={muted} />}
    />
  );
}

function Initials({ initials, muted }: { initials: string; muted: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold',
        muted
          ? 'border border-dashed border-line text-muted'
          : 'bg-pitch text-pitch-ink',
      )}
    >
      {initials || '?'}
    </span>
  );
}

/** Native confirmation dialog: focus trap, Esc and backdrop handled by the browser */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className="m-auto w-[min(92vw,400px)] rounded-panel bg-surface p-0 text-ink shadow-panel backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="grid gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div className="text-muted">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="secondary"
            className="border-danger/40 text-danger hover:bg-danger-soft"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
