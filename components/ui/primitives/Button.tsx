import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes, LabelHTMLAttributes } from "react";

// A file picker has to be a <label> wrapping a hidden <input type="file">;
// nothing else opens the dialog. /resume-maker has two, and they are supposed to
// look like outline buttons. Without the `as="label"` variant they would each
// hand-copy the variant classes, which is what the compat `.btn` was.

type BaseProps = {
  children: ReactNode;
  variant?: "primary" | "primaryInverse" | "secondary" | "outline" | "outlineInverse" | "ghost" | "danger" | "accent";
  size?: "compact" | "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
};

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button" };

type ButtonAsLink = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: "a" };

type ButtonAsLabel = BaseProps &
  LabelHTMLAttributes<HTMLLabelElement> & { as: "label" };

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsLabel;

const variantClasses: Record<NonNullable<BaseProps["variant"]>, string> = {
  primary:
    "bg-[#123B7A] text-white border border-transparent hover:bg-[#0B2D61] dark:bg-[#9FC3F2] dark:text-[#071A33] dark:hover:bg-[#C8DDFA]",
  primaryInverse:
    "bg-white text-[#0066CC] border border-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.12),inset_0_1px_0_#ffffff] hover:bg-white/95 hover:-translate-y-[1px]",
  secondary:
    "bg-[linear-gradient(180deg,#F59E0B_0%,#D97706_100%)] text-white border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_10px_-2px_rgba(217,119,6,0.4)] hover:brightness-105 hover:-translate-y-[1px]",
  outline:
    "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[var(--primary)]",
  outlineInverse:
    "backdrop-blur-md bg-white/10 text-white border border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-white/20 hover:border-white/50",
  ghost:
    "bg-black/[0.045] dark:bg-white/[0.08] text-[var(--fg)] border border-transparent hover:bg-black/[0.085] dark:hover:bg-white/[0.14] hover:text-[#0066CC] dark:hover:text-[#5AC8FA]",
  danger:
    "bg-[linear-gradient(180deg,#FF453A_0%,#D70015_100%)] text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_10px_-2px_rgba(215,0,21,0.4)] hover:brightness-105 hover:-translate-y-[1px]",
  accent:
    "bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 text-[#0066CC] dark:text-[#5AC8FA] border border-[#0071E3]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:bg-[#0071E3]/18 hover:-translate-y-[0.5px]",
};

const sizeClasses: Record<NonNullable<BaseProps["size"]>, string> = {
  compact: "px-3.5 py-1.5 text-xs min-h-[36px] rounded-lg",
  sm: "px-4 py-2 text-sm min-h-[44px] rounded-lg",
  md: "px-5 py-2.5 text-[15px] min-h-[44px] rounded-lg",
  lg: "px-7 py-3.5 text-base min-h-[52px] rounded-lg font-semibold",
};

export function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    fullWidth = false,
    isLoading = false,
    leftIcon,
    rightIcon,
    className: extraClassName = "",
    as,
    ...rest
  } = props;

  const className = [
    "inline-flex items-center justify-center gap-2 text-center font-semibold select-none transition-colors duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    extraClassName,
  ].join(" ");

  const content = (
    <>
      {isLoading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </>
  );

  if (as === "a") {
    return (
      <a className={className} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  if (as === "label") {
    return (
      <label className={`${className} cursor-pointer`} {...(rest as LabelHTMLAttributes<HTMLLabelElement>)}>
        {content}
      </label>
    );
  }

  const {
    disabled,
    type = "button",
    ...buttonRest
  } = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      type={type}
      className={`${className} disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`}
      disabled={disabled || isLoading}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
