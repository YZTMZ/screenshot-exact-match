import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Download, Pencil, PenLine, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { PhotoButton, useWorkoutFlow } from "@/components/WorkoutFlow";
import { Card, CardTitle } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { deleteWorkout, fmtDate, fmtDec, fmtInt, signedPhotoUrl, useWorkouts, type Workout } from "@/lib/data";
import { kcalPerMin } from "@/lib/calc";

export const Route = createFileRoute("/_authenticated/treinos")({
  head: () => ({ meta: [{ title: "Treinos · Spin Log" }, { name: "description", content: "Histórico dos seus treinos de spinning." }] }),
  component: Treinos,
});

function exportCsv(list: Workout[]) {
  const cols = ["date", "duration_min", "calories", "distance_km", "avg_speed_kmh", "avg_rpm", "avg_watts", "avg_heart_rate", "resistance", "source", "notes"] as const;
  const rows = [[...cols, "kcal_por_min"].join(";")].concat(
    list.map((w) => [...cols.map((c) => `"${String(w[c] ?? "").replace(/"/g, '""')}"`), kcalPerMin(w).toFixed(2)].join(";")),
  );
  const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "spin-log-treinos.csv"; a.click();
}

function Treinos() {
  const { data: list = [] } = useWorkouts();
  const { startManual, startEdit } = useWorkoutFlow();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);

  const rows = list.map((w, i) => {
    const k = kcalPerMin(w);
    const prev = i > 0 ? kcalPerMin(list[i - 1]) : null;
    return { w, k, diff: prev ? ((k - prev) / prev) * 100 : null };
  }).reverse();

  const remove = async (w: Workout) => {
    if (!confirm(`Excluir o treino de ${fmtDate(w.date)}?`)) return;
    try { await deleteWorkout(w); await qc.invalidateQueries(); toast.success("Treino excluído."); }
    catch { toast.error("Não foi possível excluir. Tente de novo."); }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">Treinos</h1>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <PhotoButton />
        <Button variant="outline" size="lg" onClick={startManual}><PenLine /> Preencher manualmente</Button>
      </div>
      <Card>
        <CardTitle right={list.length > 0 && <Button variant="ghost" size="sm" onClick={() => exportCsv(list)}><Download /> CSV</Button>}>Histórico</CardTitle>
        {list.length === 0 ? <p className="text-muted-foreground">Nenhum treino ainda.</p> : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>{["Data", "Min", "kcal", "kcal/min", "km", "FC", "Origem", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ w, k, diff }) => (
                  <tr key={w.id} className={"border-t " + (w.photo_url ? "cursor-pointer hover:bg-secondary" : "")}
                    onClick={() => w.photo_url && signedPhotoUrl(w.photo_url).then(setPhoto)}>
                    <td className="px-3 py-3 font-medium">{fmtDate(w.date)}</td>
                    <td className="num px-3 text-lg text-time">{fmtDec(Number(w.duration_min))}</td>
                    <td className="num px-3 text-lg text-kcal">{fmtInt(Number(w.calories))}</td>
                    <td className="px-3">
                      <span className="num text-lg">{fmtDec(k)}</span>
                      {diff !== null && (
                        <span className={"ml-2 inline-flex items-center gap-0.5 text-xs font-semibold " + (diff >= 0 ? "text-success" : "text-kcal")}>
                          {diff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{fmtDec(Math.abs(diff))}%
                        </span>
                      )}
                    </td>
                    <td className="px-3">{w.distance_km != null ? fmtDec(Number(w.distance_km)) : "–"}</td>
                    <td className="px-3">{w.avg_heart_rate != null ? fmtInt(Number(w.avg_heart_rate)) : "–"}</td>
                    <td className="px-3">{w.source === "photo" ? <span className="inline-flex items-center gap-1"><Camera className="h-4 w-4" />foto</span> : "manual"}</td>
                    <td className="px-1 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => startEdit(w)}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => remove(w)}><Trash2 /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="font-display">Foto do painel</DialogTitle>
          {photo && <img src={photo} alt="Foto original do painel" className="max-h-[75vh] w-full rounded-xl object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
