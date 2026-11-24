import { STATUS_LABEL, stageLabel } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "PAID" ? "green" : status === "PENDING" ? "amber" : "red";
  return <span className={`badge ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stage === "NO_AR" ? "green" : stage === "CONFIGURANDO" ? "blue" : stage === "CANCELADO" ? "red" : "gray";
  return <span className={`badge ${tone}`}>{stageLabel(stage)}</span>;
}

export function DomainBadge({ option, paid }: { option: string; paid: boolean }) {
  if (option === "OWN") return <span className="badge gray">Já tem domínio</span>;
  return <span className={`badge ${paid ? "blue" : "amber"}`}>{paid ? "Registrar (taxa paga)" : "Registrar (taxa pendente)"}</span>;
}
