// Peças visuais da área logada (cliente e admin), no estilo do Saldo Livre com as cores da BudStack.
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";

export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`ui-badge ${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="ui-page-actions">{action}</div>}
    </div>
  );
}

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={cx("ui-card", className)} style={style}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: string; action?: ReactNode }) {
  return (
    <div className="ui-card-head">
      <div className="ui-card-title">
        {icon && (
          <span className="ui-chip">
            <Icon name={icon} className="ico sm" />
          </span>
        )}
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="ui-stat">
      <span>{label}</span>
      <b className={tone ? `t-${tone}` : undefined}>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      <span className="ui-chip lg">
        <Icon name={icon} className="ico" />
      </span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}
