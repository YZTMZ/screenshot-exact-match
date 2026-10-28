import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Circle, Trophy, XCircle } from "lucide-react";
import { PhotoButton } from "@/components/WorkoutFlow";
import { Card, CardTitle, Stat } from "@/components/Stat";
import { fmtDate, fmtDec, fmtInt, todayISO, useChallenges, useWorkouts } from "@/lib/data";
import { INITIAL_CHALLENGES, kcalPerMin, weekStart } from "@/lib/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel · Spin Log" }, { name: "description", content: "Indicadores, desafios e gráficos dos seus treinos." }] }),
  component: Painel,
});

const PERIODS = [{ k: 30, l: "30 dias" }, { k: 90, l: "90 dias" }, { k: 0, l: "Tudo" }] as const;
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" } };

function Painel() {
  const { data: all = [], isLoading } = useWorkouts();
  const { data: challenges = [] } = useChallenges();
  const [period, setPeriod] = useState<number>(30);

  const list = useMemo(() => {
    if (!period) return all;
    const d = new Date(todayISO()); d.setDate(d.getDate() - period);
    const from = d.toISOString().slice(0, 10);
    return all.filter((w) => w.date >= from);
  }, [all, period]);

  const totals = useMemo(() => {
    const kcal = list.reduce((s, w) => s + Number(w.calories), 0);
    const min = list.reduce((s, w) => s + Number(w.duration_min), 0);
    const best = Math.max(0, ...list.map(kcalPerMin));
    return { n: list.length, kcal, min, avg: min ? kcal / min : 0, best };
  }, [list]);

  const perWorkout = list.map((w) => ({ d: fmtDate(w.date).slice(0, 5), kcal: Math.round(Number(w.calories)), min: Number(w.duration_min), kpm: Number(kcalPerMin(w).toFixed(2)) }));
  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((w) => { const k = weekStart(w.date); m.set(k, (m.get(k) ?? 0) + Number(w.calories)); });
    return [...m.entries()].sort().map(([k, v]) => ({ d: fmtDate(k).slice(0, 5), kcal: Math.round(v) }));
  }, [list]);

  const open = challenges.filter((c) => c.status === "open");
  const recent = challenges.filter((c) => c.status !== "open").slice(0, 4);

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl font-bold">Painel</h1>
        <PhotoButton className="sm:w-auto" />
      </div>

      {all.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="text-3xl font-bold">Seu primeiro treino começa aqui</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Ao terminar, tire uma foto do painel da bike. Os dados são preenchidos automaticamente.</p>
          <ChallengesInitial />
        </Card>
      ) : (
        <>
          <div className="flex gap-2" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button key={p.k} onClick={() => setPeriod(p.k)} aria-pressed={period === p.k}
                className={cn("h-10 rounded-full border px-4 text-sm font-medium", period === p.k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
                {p.l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Treinos" value={fmtInt(totals.n)} />
            <Stat label="Calorias" value={fmtInt(totals.kcal)} unit="kcal" tone="kcal" />
            <Stat label="Tempo total" value={fmtInt(totals.min)} unit="min" tone="time" />
            <Stat label="kcal/min médio" value={fmtDec(totals.avg)} />
            <Stat label="Melhor kcal/min" value={fmtDec(totals.best)} tone="success" />
          </div>

          <Card>
            <CardTitle>Desafios para o próximo treino</CardTitle>
            {open.length === 0 ? <ChallengesInitial /> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {open.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3"><Circle className="h-5 w-5 text-muted-foreground" /><span className="font-medium">{c.title}</span></li>
                ))}
              </ul>
            )}
            {recent.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {recent.map((c) => (
                  <span key={c.id} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", c.status === "done" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                    {c.status === "done" ? <Trophy className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{c.title}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {list.length === 0 ? <Card><p className="text-muted-foreground">Nenhum treino neste período.</p></Card> : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardTitle>Calorias e duração por treino</CardTitle>
                <div className="h-64">
                  <ResponsiveContainer>
                    <ComposedChart data={perWorkout}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="d" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis yAxisId="k" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={40} />
                      <YAxis yAxisId="m" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={32} />
                      <Tooltip {...tip} />
                      <Legend />
                      <Bar yAxisId="k" dataKey="kcal" name="kcal" fill="var(--kcal)" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="m" dataKey="min" name="minutos" stroke="var(--time)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardTitle>Eficiência (kcal/min)</CardTitle>
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={perWorkout}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="d" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={36} domain={["auto", "auto"]} />
                      <Tooltip {...tip} />
                      <Line dataKey="kpm" name="kcal/min" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardTitle>Calorias por semana</CardTitle>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={weekly}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="d" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={40} />
                      <Tooltip {...tip} />
                      <Bar dataKey="kcal" name="kcal (semana)" fill="var(--kcal)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChallengesInitial() {
  return (
    <ul className="mx-auto mt-4 grid max-w-xl gap-2 text-left">
      {INITIAL_CHALLENGES.map((t) => (
        <li key={t} className="flex items-center gap-3 rounded-xl bg-secondary p-3"><CheckCircle2 className="h-5 w-5 text-time" />{t}</li>
      ))}
    </ul>
  );
}
