import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card p-4 sm:p-5", className)}>{children}</section>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "kcal" | "time" | "success" }) {
  const c = tone === "kcal" ? "text-kcal" : tone === "time" ? "text-time" : tone === "success" ? "text-success" : "";
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-3xl sm:text-4xl", c)}>
        {value}{unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
