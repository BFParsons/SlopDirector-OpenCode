import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ease-spring will-change-transform " +
    "hover:scale-[1.05] hover:-translate-y-0.5 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:active:scale-100";
  const styles = {
    primary:
      "bg-[var(--color-control)] text-[var(--color-control-fg)] border border-[#454d5c] shadow-soft hover:bg-[var(--color-control-hover)] hover:shadow-lift",
    ghost:
      "border border-[var(--color-border)] bg-[var(--color-surface)]/40 text-[var(--color-fg)] hover:bg-[var(--color-surface)] hover:border-[#39414f] hover:shadow-soft",
    danger:
      "bg-[var(--color-danger)] text-white shadow-soft hover:shadow-lift hover:brightness-110",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs outline-none short:px-1.5 short:py-1 transition duration-150 ease-out-soft hover:border-[#39414f] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs outline-none short:px-1.5 short:py-1 transition duration-150 ease-out-soft hover:border-[#39414f] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs outline-none short:px-1.5 short:py-1 transition duration-150 ease-out-soft hover:border-[#39414f] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    // On short viewports the hint moves into a tooltip so narrow panels don't
    // spend three lines of height on helper text.
    <label className="block text-xs font-medium text-[var(--color-muted)] mb-1" title={hint}>
      {children}
      {hint ? <span className="ml-2 font-normal opacity-70 short:hidden">{hint}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-soft transition duration-200 ease-spring hover:-translate-y-px hover:shadow-lift ${className}`}
    >
      {children}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--color-muted)",
  SUBMITTED: "var(--color-warning)",
  RENDERING: "var(--color-warning)",
  DOWNLOADING: "var(--color-warning)",
  RUNNING: "var(--color-warning)",
  READY: "var(--color-success)",
  DONE: "var(--color-success)",
  FAILED: "var(--color-danger)",
  DRAFT: "var(--color-muted)",
};

const ACTIVE_STATUSES = new Set(["SUBMITTED", "RENDERING", "DOWNLOADING", "RUNNING"]);

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--color-muted)";
  const active = ACTIVE_STATUSES.has(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: color,
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${active ? "animate-pulse" : ""}`}
        style={{ background: color }}
      />
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
