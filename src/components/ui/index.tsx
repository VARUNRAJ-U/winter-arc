import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { getAsset, type AssetKey } from '@/assets';
import { clamp } from '@/utils/format';
import { useEscapeKey, useFocusTrap, useScrollLock, usePrefersReducedMotion } from '@/hooks';
import './ui.css';

export { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------- GlassCard */

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'solid' | 'soft' | 'flat';
  glow?: boolean;
  pad?: boolean | 'sm';
  sheen?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

export function GlassCard({
  variant = 'default',
  glow = false,
  pad = true,
  sheen = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: GlassCardProps) {
  const classes = [
    'glass',
    variant !== 'default' ? `glass--${variant}` : '',
    glow ? 'glass--glow' : '',
    pad === true ? 'glass--pad' : pad === 'sm' ? 'glass--padSm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} {...rest}>
      {sheen ? <span className="glass__sheen" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------- Button */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block = false, iconLeft, iconRight, className = '', children, type = 'button', ...rest },
  ref,
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {iconLeft ? <Icon name={iconLeft} size={19} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={19} /> : null}
    </button>
  );
});

export const PrimaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  function PrimaryButton(props, ref) {
    return <Button ref={ref} variant="primary" {...props} />;
  },
);

export const SecondaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  function SecondaryButton(props, ref) {
    return <Button ref={ref} variant="secondary" {...props} />;
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: an icon-only control must announce itself. */
  label: string;
  size?: number;
  bordered?: boolean;
  active?: boolean;
  large?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 21, bordered = false, active = false, large = false, className = '', type = 'button', ...rest },
  ref,
) {
  const classes = [
    'icon-btn',
    bordered ? 'icon-btn--bordered' : '',
    active ? 'icon-btn--active' : '',
    large ? 'icon-btn--lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
});

/* ----------------------------------------------------------- ProgressBar */

export interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
  tone?: string;
}

export function ProgressBar({ value, size = 'md', label, className = '', tone }: ProgressBarProps) {
  const pct = clamp(value, 0, 1);
  return (
    <div
      className={['pbar', size !== 'md' ? `pbar--${size}` : '', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span
        className="pbar__fill"
        style={{ ['--value' as string]: String(pct), ...(tone ? { background: tone } : {}) }}
      />
    </div>
  );
}

/* ---------------------------------------------------------- ProgressRing */

export interface ProgressRingProps {
  value: number;
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label?: string;
  halo?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 200,
  thickness = 10,
  children,
  label,
  halo = true,
  className = '',
}: ProgressRingProps) {
  const pct = clamp(value, 0, 1);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const reduced = usePrefersReducedMotion();

  return (
    <div className={['ring', className].filter(Boolean).join(' ')} style={{ width: size, height: size }}>
      {halo && !reduced ? <span className="ring__halo" aria-hidden="true" /> : null}
      <svg
        className="ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={label ? 'img' : 'presentation'}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {label ? <title>{label}</title> : null}
        <defs>
          <linearGradient id="wa-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-blue)" />
            <stop offset="55%" stopColor="var(--accent-cyan)" />
            <stop offset="100%" stopColor="var(--accent-ice)" />
          </linearGradient>
        </defs>
        <circle
          className="ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
        />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------- SegmentedTabs */

export interface SegmentedTabsProps<T extends string> {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: SegmentedTabsProps<T>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === value));

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index];
      if (!el) return;
      setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [index, items.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + items.length) % items.length;
    onChange(items[next].value);
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    el?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={['segmented', className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      onKeyDown={onKeyDown}
    >
      {thumb ? (
        <span
          className="segmented__thumb"
          aria-hidden="true"
          style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }}
        />
      ) : null}
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          className="segmented__item"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- XPBadge */

export function XPBadge({ xp, prefix = '+' }: { xp: number; prefix?: string }) {
  const value = Math.round(xp);
  return (
    <span className="xp-badge">
      <Icon name="bolt" size={15} />
      {value > 0 ? prefix : ''}
      {value.toLocaleString('en-US')} XP
    </span>
  );
}

/* -------------------------------------------------------------- StatCard */

export interface StatCardProps {
  icon: IconName;
  value: string;
  label: string;
  delta?: number;
  deltaSuffix?: string;
}

export function StatCard({ icon, value, label, delta, deltaSuffix = '%' }: StatCardProps) {
  const tone = delta === undefined ? null : delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
  return (
    <div className="stat-card">
      <span className="stat-card__icon" aria-hidden="true">
        <Icon name={icon} size={21} />
      </span>
      <div>
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
        {tone ? (
          <div className={`stat-card__delta stat-card__delta--${tone}`}>
            {delta! > 0 ? '+' : ''}
            {Math.round(delta!)}
            {deltaSuffix} vs previous
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Modal */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const trapRef = useFocusTrap(open);
  const titleId = useId();
  useScrollLock(open);
  useEscapeKey(open, onClose);

  if (!open) return null;

  return createPortal(
    <div className="overlay overlay--center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={trapRef}
        className="modal wa-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="modal__sub">{description}</p> : null}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        {children}
        {footer ? <div className="modal__actions">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ open, onClose, title, description, children, footer }: BottomSheetProps) {
  const trapRef = useFocusTrap(open);
  const titleId = useId();
  useScrollLock(open);
  useEscapeKey(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay overlay--bottom"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 'var(--z-sheet)' }}
    >
      <div
        ref={trapRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ animation: 'wa-rise var(--dur-slow) var(--ease-out)' }}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="modal__sub">{description}</p> : null}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        {children}
        {footer ? <div className="modal__actions">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Field */

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['field', error ? 'field--invalid' : '', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
});

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  rows = 4,
  placeholder,
  id,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Toggle */

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-row__text">
        <span className="toggle-row__title">{title}</span>
        {description ? <span className="toggle-row__desc">{description}</span> : null}
      </span>
      <span className="toggle" aria-hidden="true" data-on={checked}>
        <span className="toggle__knob" />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- Stepper */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  format,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  format?: (value: number) => string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
      >
        <Icon name="minus" size={17} />
      </button>
      <span className="stepper__value" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(2))))}
      >
        <Icon name="plus" size={17} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- ListRow */

export function ListRow({
  icon,
  title,
  description,
  value,
  onClick,
  chevron = true,
  trailing,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  value?: string;
  onClick?: () => void;
  chevron?: boolean;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon ? (
        <span className="list-row__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className="list-row__body">
        <span className="list-row__title">{title}</span>
        {description ? <span className="list-row__desc">{description}</span> : null}
      </span>
      {value ? <span className="list-row__value">{value}</span> : null}
      {trailing}
      {onClick && chevron ? (
        <span className="list-row__chev" aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      ) : null}
    </>
  );

  if (!onClick) return <div className="list-row">{content}</div>;
  return (
    <button type="button" className="list-row" onClick={onClick}>
      {content}
    </button>
  );
}

/* ------------------------------------------------------------ ImageHero */

export interface ImageHeroProps {
  asset: AssetKey;
  height?: number | string;
  scrim?: 'bottom' | 'top' | 'full' | 'none';
  drift?: boolean;
  children?: ReactNode;
  className?: string;
  /** Decorative by default: pass true where the artwork carries meaning. */
  meaningful?: boolean;
  radius?: string;
  eager?: boolean;
}

export function ImageHero({
  asset,
  height = 220,
  scrim = 'bottom',
  drift = false,
  children,
  className = '',
  meaningful = false,
  radius,
  eager = false,
}: ImageHeroProps) {
  const def = getAsset(asset);
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={['hero', className].filter(Boolean).join(' ')}
      style={{ height, ...(radius ? { borderRadius: radius } : {}) }}
    >
      {failed ? (
        <span className="hero__fallback" aria-hidden="true" />
      ) : (
        <img
          className={['hero__img', drift && !reduced ? 'hero__img--drift' : ''].filter(Boolean).join(' ')}
          src={def.src}
          alt={meaningful ? def.alt : ''}
          aria-hidden={meaningful ? undefined : true}
          style={{ objectPosition: def.position }}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {scrim !== 'none' ? (
        <span
          className={`hero__scrim${scrim === 'top' ? ' hero__scrim--top' : scrim === 'full' ? ' hero__scrim--full' : ''}`}
          aria-hidden="true"
        />
      ) : null}
      {children ? <div className="hero__content">{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------- MountainBackground */

export function MountainBackground({ asset = 'snowMountains' as AssetKey }: { asset?: AssetKey }) {
  const def = getAsset(asset);
  const reduced = usePrefersReducedMotion();
  return (
    <div className="mountain-bg" aria-hidden="true">
      <img className="mountain-bg__img" src={def.src} alt="" loading="lazy" decoding="async" />
      <span className="mountain-bg__wash" />
      {!reduced ? <span className="mountain-bg__aurora" /> : null}
    </div>
  );
}

export function Snowfall({ count = 26 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 1.5 + Math.random() * 2.6,
        duration: 14 + Math.random() * 16,
        delay: -Math.random() * 26,
        drift: `${(Math.random() - 0.5) * 70}px`,
        opacity: 0.22 + Math.random() * 0.4,
      })),
    [count],
  );

  return (
    <div className="snowfall" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snowfall__flake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            ['--flake-drift' as string]: f.drift,
            ['--flake-opacity' as string]: String(f.opacity),
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- EmptyState */

export function EmptyState({
  icon = 'spark',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <p className="empty__title">{title}</p>
      {description ? <p className="empty__desc">{description}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ CheckMark */

export function CheckMark({ on, small = false }: { on: boolean; small?: boolean }) {
  return (
    <span
      className={['checkmark', on ? 'checkmark--on' : '', small ? 'checkmark--sm' : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <Icon name="check" size={small ? 13 : 16} strokeWidth={2.6} />
    </span>
  );
}

/* ----------------------------------------------------------------- Chip */

export function Chip({
  children,
  tone = 'default',
  icon,
}: {
  children: ReactNode;
  tone?: 'default' | 'complete' | 'accent';
  icon?: IconName;
}) {
  return (
    <span className={['chip', tone !== 'default' ? `chip--${tone}` : ''].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Toast */

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; tone: 'info' | 'success' | 'warning' }[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={['toast', t.tone !== 'info' ? `toast--${t.tone}` : ''].filter(Boolean).join(' ')}
          onClick={() => onDismiss(t.id)}
        >
          <span className="toast__icon" aria-hidden="true">
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'warning' ? 'alert' : 'spark'} size={17} />
          </span>
          {t.message}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- Section */

export function Section({
  title,
  meta,
  children,
  action,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">{title}</h2>
        {meta ? <span className="section__meta">{meta}</span> : null}
        {action}
      </header>
      {children}
    </section>
  );
}

/** Announces a message to assistive tech without showing it. */
export function LiveRegion({ message }: { message: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!message) return;
    setText('');
    const id = window.setTimeout(() => setText(message), 60);
    return () => window.clearTimeout(id);
  }, [message]);
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {text}
    </span>
  );
}
