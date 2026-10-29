import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardTitle } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { readPhoto } from "@/lib/vision.functions";
import { fmtDate, fmtDec, fmtInt, prepareImage, todayISO, uploadPhoto, useGoal, useWeights, useWorkouts } from "@/lib/data";
import { kgPerWeekNeeded, weightValid, workoutsRemaining } from "@/lib/calc";

export const Route = createFileRoute("/_authenticated/peso")({
  head: () => ({ meta: [{ title: "Peso · Spin Log" }, { name: "description", content: "Meta de peso, pesagens e estimativas." }] }),
  component: Peso,
});

const num = (s: string) => Number(s.replace(",", "."));

function Peso() {
  const qc = useQueryClient();
  const { data: weights = [] } = useWeights();
  const { data: goal } = useGoal();
  const { data: workouts = [] } = useWorkouts();
  const read = useServerFn(readPhoto);
  const fileRef = useRef<HTMLInputElement>(null);

  const [g, setG] = useState({ start: "", target: "", deadline: "" });
  useEffect(() => {
    if (goal) setG({ start: String(goal.start_weight_kg), target: String(goal.target_weight_kg), deadline: goal.deadline ?? "" });
  }, [goal]);
  const [entry, setEntry] = useState({ date: todayISO(), kg: "" });
  const [scale, setScale] = useState<{ blob: Blob; url: string } | null>(null);
  const [reading, setReading] = useState(false);

  const current = weights.length ? Number(weights.at(-1)!.weight_kg) : goal ? Number(goal.start_weight_kg) : null;
  const start = goal ? Number(goal.start_weight_kg) : null;
  const target = goal ? Number(goal.target_weight_kg) : null;
  const lost = start != null && current != null ? start - current : 0;
  const left = target != null && current != null ? Math.max(0, current - target) : 0;
  const pct = start != null && target != null && start !== target ? Math.min(100, Math.max(0, (lost / (start - target)) * 100)) : 0;
  const avgKcal = workouts.length ? workouts.reduce((s, w) => s + Number(w.calories), 0) / workouts.length : 0;
  const remaining = current != null && target != null ? workoutsRemaining(current, target, avgKcal) : 0;
  const perWeek = goal?.deadline && current != null && target != null ? kgPerWeekNeeded(current, target, goal.deadline, todayISO()) : null;

  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = num(g.start), t = num(g.target);
    if (!weightValid(s) || !weightValid(t)) { toast.error("Os pesos precisam estar entre 20 e 400 kg."); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("weight_goals").upsert({ user_id: u.user!.id, start_weight_kg: s, target_weight_kg: t, deadline: g.deadline || null });
    if (error) { toast.error("Não foi possível salvar a meta. Tente de novo."); return; }
    toast.success("Meta salva."); qc.invalidateQueries();
  };

  const onScale = async (file?: File) => {
    if (!file) return;
    setReading(true);
    try {
      const img = await prepareImage(file, 1200);
      setScale({ blob: img.blob, url: img.dataUrl });
      const r = await read({ data: { image: img.dataUrl, kind: "scale" } });
      if (!r.ok) toast.error(r.error);
      else if (r.kind === "scale" && r.data.weight_kg != null) setEntry((x) => ({ ...x, kg: String(r.data.weight_kg) }));
      else toast.error("Não consegui ler a balança. Tente uma foto mais próxima ou digite o peso.");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao ler a foto. Tente de novo."); }
    setReading(false);
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const kg = num(entry.kg);
    if (!weightValid(kg)) { toast.error("O peso precisa estar entre 20 e 400 kg."); return; }
    try {
      const photo_url = scale ? await uploadPhoto(scale.blob, "scale") : null;
      const { error } = await supabase.from("weight_entries").insert({ date: entry.date, weight_kg: kg, photo_url, source: scale ? "photo" : "manual" });
      if (error) throw error;
      toast.success("Pesagem salva."); setEntry({ date: todayISO(), kg: "" }); setScale(null); qc.invalidateQueries();
    } catch { toast.error("Não foi possível salvar a pesagem. Tente de novo."); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta pesagem?")) return;
    await supabase.from("weight_entries").delete().eq("id", id); qc.invalidateQueries();
  };

  const chart = weights.map((w) => ({ d: fmtDate(w.date).slice(0, 5), kg: Number(w.weight_kg) }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">Peso</h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardTitle>Progresso</CardTitle>
          {current == null ? <p className="text-muted-foreground">Defina uma meta ou registre uma pesagem.</p> : (
            <>
              <div className="num text-6xl">{fmtDec(current)}<span className="ml-1 text-xl text-muted-foreground">kg</span></div>
              {goal && (
                <>
                  <Progress value={pct} className="mt-4 h-3 [&>div]:bg-success" aria-label="Progresso da meta" />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{fmtDec(start!)} kg</span><span>meta {fmtDec(target!)} kg</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div><div className="num text-2xl text-success">{fmtDec(lost)}</div><div className="text-xs text-muted-foreground">kg perdidos</div></div>
                    <div><div className="num text-2xl">{fmtDec(left)}</div><div className="text-xs text-muted-foreground">kg faltam</div></div>
                    <div><div className="num text-2xl">{fmtInt(pct)}%</div><div className="text-xs text-muted-foreground">da meta</div></div>
                  </div>
                  <div className="mt-4 space-y-2 rounded-xl bg-secondary p-3 text-sm">
                    {left > 0 && avgKcal > 0 && <p>Cerca de <b>{fmtInt(remaining)} treinos</b> restantes, na média de {fmtInt(avgKcal)} kcal por treino (7.700 kcal ≈ 1 kg).</p>}
                    {perWeek != null && left > 0 && (
                      <p>{Number.isFinite(perWeek) ? <>Para o prazo, seriam <b>{fmtDec(perWeek, 2)} kg por semana</b>.</> : "O prazo já passou."} Perdas de cerca de 0,5 a 1 kg por semana costumam ser consideradas sustentáveis.</p>
                    )}
                    <p className="text-xs text-muted-foreground">Estimativa: não considera alimentação nem outras atividades.</p>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
        <Card>
          <CardTitle>Evolução</CardTitle>
          {chart.length < 1 ? <p className="text-muted-foreground">Sem pesagens ainda.</p> : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={36} domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  {target != null && <ReferenceLine y={target} stroke="var(--success)" strokeDasharray="6 4" label={{ value: "meta", fill: "var(--success)", fontSize: 12 }} />}
                  <Line dataKey="kg" stroke="var(--time)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Meta</CardTitle>
          <form onSubmit={saveGoal} className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="gs">Peso inicial (kg)</Label><Input id="gs" inputMode="decimal" className="h-11" value={g.start} onChange={(e) => setG({ ...g, start: e.target.value })} required /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="gt">Meta (kg)</Label><Input id="gt" inputMode="decimal" className="h-11" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} required /></div>
            <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="gd">Prazo (opcional)</Label><Input id="gd" type="date" className="h-11" value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} /></div>
            <Button type="submit" className="col-span-2">Salvar meta</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Nova pesagem</CardTitle>
          <form onSubmit={saveEntry} className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="ed">Data</Label><Input id="ed" type="date" className="h-11" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} required /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="ek">Peso (kg)</Label><Input id="ek" inputMode="decimal" className="h-11" value={entry.kg} onChange={(e) => setEntry({ ...entry, kg: e.target.value })} required /></div>
            {scale && <img src={scale.url} alt="Foto da balança" className="col-span-2 max-h-40 w-full rounded-xl border object-contain" />}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onScale(e.target.files?.[0]); e.target.value = ""; }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={reading}>
              {reading ? <Loader2 className="animate-spin" /> : <Camera />} {reading ? "Lendo…" : "Foto da balança"}
            </Button>
            <Button type="submit">Salvar pesagem</Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Pesagens</CardTitle>
        {weights.length === 0 ? <p className="text-muted-foreground">Nenhuma pesagem.</p> : (
          <ul className="divide-y">
            {[...weights].reverse().map((w, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? Number(w.weight_kg) - Number(prev.weight_kg) : null;
              return (
                <li key={w.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 text-sm text-muted-foreground">{fmtDate(w.date)}</span>
                  <span className="num text-xl">{fmtDec(Number(w.weight_kg))} kg</span>
                  {d !== null && d !== 0 && <span className={"text-sm font-semibold " + (d < 0 ? "text-success" : "text-kcal")}>{d > 0 ? "+" : ""}{fmtDec(d)}</span>}
                  {w.source === "photo" && <Camera className="h-4 w-4 text-muted-foreground" aria-label="por foto" />}
                  <Button variant="ghost" size="icon" className="ml-auto" aria-label="Excluir pesagem" onClick={() => remove(w.id)}><Trash2 /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
