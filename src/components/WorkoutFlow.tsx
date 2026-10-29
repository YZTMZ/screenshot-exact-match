import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Camera, Loader2, RotateCcw, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readPhoto, type WorkoutReading } from "@/lib/vision.functions";
import {
  prepareImage, saveWorkout, signedPhotoUrl, summaryMessage, todayISO, updateWorkout, uploadPhoto,
  useWorkouts, type Workout, type WorkoutInput,
} from "@/lib/data";
import { isDuplicate, parseDuration, sanityWarnings } from "@/lib/calc";
import { cn } from "@/lib/utils";

type Mode = "photo" | "manual" | "edit";
type Phase = "reading" | "error" | "form";

interface Ctx {
  startPhoto: () => void;
  startManual: () => void;
  startEdit: (w: Workout) => void;
}
// Keep a single context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __spinFlowCtx?: React.Context<Ctx | null> };
const FlowCtx = (g.__spinFlowCtx ??= createContext<Ctx | null>(null));
const noop: Ctx = { startPhoto: () => {}, startManual: () => {}, startEdit: () => {} };
export const useWorkoutFlow = () => useContext(FlowCtx) ?? noop;

const FIELDS = [
  { key: "duration_min", label: "Duração (min ou mm:ss)", required: true, mode: "text" },
  { key: "calories", label: "Calorias (kcal)", required: true },
  { key: "distance_km", label: "Distância (km)" },
  { key: "avg_speed_kmh", label: "Velocidade média (km/h)" },
  { key: "avg_rpm", label: "RPM médio" },
  { key: "avg_watts", label: "Watts médio" },
  { key: "avg_heart_rate", label: "FC média (bpm)" },
  { key: "resistance", label: "Resistência" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];
type FormState = Record<FieldKey, string> & { date: string; notes: string };

const empty = (): FormState => ({
  date: todayISO(), notes: "", duration_min: "", calories: "", distance_km: "", avg_speed_kmh: "",
  avg_rpm: "", avg_watts: "", avg_heart_rate: "", resistance: "",
});
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function WorkoutFlowProvider({ children }: { children: ReactNode }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: workouts = [] } = useWorkouts();
  const read = useServerFn(readPhoto);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("manual");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [form, setForm] = useState<FormState>(empty());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [lowConfidence, setLowConfidence] = useState(false);
  const [dupConfirm, setDupConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setError(null); setPreview(null); setImage(null); setEditing(null); setForm(empty());
    setFlagged(new Set()); setLowConfidence(false); setDupConfirm(false);
  };

  const runRead = async (img: { blob: Blob; dataUrl: string }) => {
    setPhase("reading"); setError(null);
    try {
      const r = await read({ data: { image: img.dataUrl, kind: "workout" } });
      if (!r.ok) { setError(r.error); setPhase("error"); return; }
      const d = r.data as WorkoutReading;
      if (d.duration_min == null && d.calories == null) {
        setError("Não consegui ler o painel. Tente uma foto mais próxima e sem reflexo, ou preencha manualmente.");
        setPhase("error");
        return;
      }
      const f = empty();
      if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) f.date = d.date;
      for (const { key } of FIELDS) f[key] = s(d[key]);
      setForm(f);
      const fl = new Set<string>(d.unreadable_fields ?? []);
      (["duration_min", "calories"] as const).forEach((key) => { if (d[key] == null) fl.add(key); });
      setFlagged(fl);
      setLowConfidence(d.confidence !== "alta");
      setPhase("form");
    } catch {
      setError("Falha de conexão ao ler a foto. Tente de novo.");
      setPhase("error");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset(); setMode("photo"); setOpen(true); setPhase("reading");
    try {
      const img = await prepareImage(file);
      setImage(img); setPreview(img.dataUrl);
      await runRead(img);
    } catch (e: any) {
      setError(e.message); setPhase("error");
    }
  };

  const ctx = useMemo<Ctx>(() => ({
    startPhoto: () => fileRef.current?.click(),
    startManual: () => { reset(); setMode("manual"); setPhase("form"); setOpen(true); },
    startEdit: (w) => {
      reset(); setMode("edit"); setEditing(w); setPhase("form");
      const f = empty(); f.date = w.date; f.notes = w.notes ?? "";
      for (const { key } of FIELDS) f[key] = s(w[key]);
      setForm(f); setOpen(true);
      if (w.photo_url) signedPhotoUrl(w.photo_url).then(setPreview);
    },
  }), []);

  const parsed = useMemo(() => {
    const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    return {
      date: form.date,
      duration_min: parseDuration(form.duration_min),
      calories: n(form.calories),
      distance_km: n(form.distance_km), avg_speed_kmh: n(form.avg_speed_kmh), avg_rpm: n(form.avg_rpm),
      avg_watts: n(form.avg_watts), avg_heart_rate: n(form.avg_heart_rate), resistance: n(form.resistance),
      notes: form.notes.trim() || null,
    };
  }, [form]);
  const warnings = sanityWarnings(parsed);
  const invalid =
    !parsed.date || parsed.duration_min == null || !(parsed.duration_min > 0) ||
    parsed.calories == null || !(parsed.calories >= 0) ||
    Object.values(parsed).some((v) => typeof v === "number" && !Number.isFinite(v));

  const onSave = async () => {
    if (invalid) return;
    const candidate = { id: editing?.id, date: parsed.date, duration_min: parsed.duration_min!, calories: parsed.calories! };
    if (!dupConfirm && isDuplicate(candidate, workouts)) { setDupConfirm(true); return; }
    setSaving(true);
    try {
      const input: WorkoutInput = { ...parsed, duration_min: parsed.duration_min!, calories: parsed.calories! };
      if (mode === "edit" && editing) {
        await updateWorkout(editing.id, input);
        toast.success("Treino atualizado.");
      } else {
        let photo_url: string | null = null;
        if (mode === "photo" && image) photo_url = await uploadPhoto(image.blob, "workouts");
        const r = await saveWorkout({ ...input, photo_url, source: mode === "photo" ? "photo" : "manual" }, workouts);
        toast.success("Treino salvo!", { description: summaryMessage(r) });
        r.completed.forEach((c) =>
          toast(`Desafio cumprido: ${c.title}`, { icon: <Trophy className="h-4 w-4 text-success" /> }),
        );
      }
      await qc.invalidateQueries();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { setDupConfirm(false); }, [form.date, form.duration_min, form.calories]);

  const title = mode === "edit" ? "Editar treino" : mode === "photo" ? "Confira o treino" : "Novo treino";

  return (
    <FlowCtx.Provider value={ctx}>
      {children}
      <input
        ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
      />
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-h-[100dvh] w-full max-w-3xl overflow-y-auto rounded-none p-4 sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            <DialogDescription>
              {mode === "photo" ? "Os dados foram lidos da foto. Confira e salve." : "Preencha os dados do treino."}
            </DialogDescription>
          </DialogHeader>

          <div className={cn("grid gap-5", preview && "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
            {preview && (
              <div className="md:sticky md:top-0 md:self-start">
                <img src={preview} alt="Foto do painel" className="max-h-64 w-full rounded-xl border object-contain md:max-h-[70vh]" />
              </div>
            )}

            {phase === "reading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground" role="status">
                <Loader2 className="h-8 w-8 animate-spin text-kcal" />
                <p className="font-display text-xl">Lendo o painel…</p>
              </div>
            )}

            {phase === "error" && (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  <p>{error}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {image && (
                    <Button onClick={() => runRead(image)}><RotateCcw /> Tentar de novo</Button>
                  )}
                  <Button variant="outline" onClick={() => fileRef.current?.click()}><Camera /> Outra foto</Button>
                  <Button variant="outline" onClick={() => { setMode("manual"); setPhase("form"); }}>Preencher manualmente</Button>
                </div>
              </div>
            )}

            {phase === "form" && (
              <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
                {lowConfidence && (
                  <p className="rounded-lg bg-warning-soft p-3 text-sm">A leitura teve dúvidas. Confira os valores destacados.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="date">Data</Label>
                    <Input id="date" type="date" className="h-11" value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  {FIELDS.map((f) => {
                    const warn = flagged.has(f.key) || warnings.some((w) => w.field === f.key);
                    return (
                      <div key={f.key} className="flex flex-col gap-1.5">
                        <Label htmlFor={f.key} className="text-xs sm:text-sm">
                          {f.label}{"required" in f && f.required ? " *" : ""}
                        </Label>
                        <Input
                          id={f.key} inputMode={"mode" in f ? "text" : "decimal"} className={cn("h-11", warn && "border-warning ring-1 ring-warning")}
                          value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          aria-describedby={warn ? `${f.key}-warn` : undefined}
                        />
                        {warn && <span id={`${f.key}-warn`} className="text-xs font-medium text-warning">Confira este valor</span>}
                      </div>
                    );
                  })}
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>

                {warnings.map((w) => (
                  <p key={w.field} className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{w.message}</p>
                ))}
                {dupConfirm && (
                  <p className="rounded-lg bg-warning-soft p-3 text-sm">Já existe um treino com a mesma data, duração e calorias. Salvar mesmo assim?</p>
                )}

                <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background p-4 pb-safe sm:static sm:mx-0 sm:border-0 sm:p-0">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
                  <Button type="submit" variant="kcal" className="flex-[2]" disabled={invalid || saving}>
                    {saving && <Loader2 className="animate-spin" />}
                    {dupConfirm ? "Salvar mesmo assim" : "Salvar treino"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </FlowCtx.Provider>
  );
}

export function PhotoButton({ className }: { className?: string }) {
  const { startPhoto } = useWorkoutFlow();
  return (
    <Button variant="kcal" size="lg" className={cn("w-full", className)} onClick={startPhoto}>
      <Camera className="!size-5" /> Enviar foto do treino
    </Button>
  );
}
