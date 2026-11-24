import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <Link href="/" className="logo" aria-label="BudStack, página inicial">
          <span className="logo-mark">B</span>
          <span>BudStack</span>
        </Link>
        <div className="card">{children}</div>
        <p className="muted" style={{ fontSize: 13.5, textAlign: "center", marginTop: 16 }}>
          Ainda não é cliente?{" "}
          <Link href="/planos" style={{ color: "var(--blue)", fontWeight: 700 }}>
            Conheça os planos
          </Link>
        </p>
      </div>
    </main>
  );
}
