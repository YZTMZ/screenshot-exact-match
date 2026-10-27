import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { evaluateChallenge, generateChallenges, kcalPerMin, weekStart } from "./calc";

export type Workout = Tables<"workouts">;
export type WeightEntry = Tables<"weight_entries">;
export type WeightGoal = Tables<"weight_goals">;
export type Challenge = Tables<"challenges">;

export const qk = {
  workouts: ["workouts"] as const,
  weights: ["weights"] as const,
  goal: ["goal"] as const,
  challenges: ["challenges"] as const,
};

function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export function useWorkouts() {
  return useQuery({
    queryKey: qk.workouts,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("workouts")
          .select("*")
          .order("date", { ascending: true })
          .order("created_at", { ascending: true }),
      ) as Workout[],
  });
}

export function useWeights() {
  return useQuery({
    queryKey: qk.weights,
    queryFn: async () =>
      unwrap(
        await supabase.from("weight_entries").select("*").order("date").order("created_at"),
      ) as WeightEntry[],
  });
}

export function useGoal() {
  return useQuery({
    queryKey: qk.goal,
    queryFn: async () =>
      unwrap(await supabase.from("weight_goals").select("*").maybeSingle()) as WeightGoal | null,
  });
}

export function useChallenges() {
  return useQuery({
    queryKey: qk.challenges,
    queryFn: async () =>
      unwrap(
        await supabase.from("challenges").select("*").order("created_date", { ascending: false }).limit(40),
      ) as Challenge[],
  });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/* ---------- Photos ---------- */

export async function prepareImage(file: File, max = 1600): Promise<{ blob: Blob; dataUrl: string }> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("Não foi possível abrir a imagem. Use JPG, PNG ou HEIC convertido.");
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return { blob, dataUrl };
}

export async function uploadPhoto(blob: Blob, folder: "workouts" | "scale"): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
  const path = `${u.user.id}/${folder}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Falha ao enviar a foto. Verifique a conexão.");
  return path;
}

export async function signedPhotoUrl(path: string) {
  const { data } = await supabase.storage.from("photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* ---------- Workouts ---------- */

export type WorkoutInput = Omit<TablesInsert<"workouts">, "user_id" | "id" | "created_at">;

export interface SaveResult {
  workout: Workout;
  previous: Workout | null;
  completed: Challenge[];
}

export async function saveWorkout(input: WorkoutInput, existing: Workout[]): Promise<SaveResult> {
  const workout = unwrap(await supabase.from("workouts").insert(input).select().single()) as Workout;

  const sorted = [...existing].sort((a, b) => (a.date + a.created_at).localeCompare(b.date + b.created_at));
  const previous = sorted.filter((w) => w.date <= workout.date).at(-1) ?? null;

  // Evaluate open challenges
  const open = unwrap(await supabase.from("challenges").select("*").eq("status", "open")) as Challenge[];
  const wk = weekStart(workout.date);
  const inWeek = [...existing, workout].filter((w) => weekStart(w.date) === wk).length;
  const completed: Challenge[] = [];
  let frequencyStillOpen = false;
  for (const c of open) {
    const status = evaluateChallenge(c, workout, inWeek);
    if (status === null) {
      frequencyStillOpen = true;
      continue;
    }
    await supabase.from("challenges").update({ status }).eq("id", c.id);
    if (status === "done") completed.push({ ...c, status });
  }

  // Generate new challenges from this workout
  const drafts = generateChallenges(workout).filter((d) => !(d.type === "frequency" && frequencyStillOpen));
  if (drafts.length) {
    await supabase.from("challenges").insert(drafts.map((d) => ({ ...d, workout_id_base: workout.id })));
  }

  return { workout, previous, completed };
}

export async function updateWorkout(id: string, input: WorkoutInput) {
  unwrap(await supabase.from("workouts").update(input).eq("id", id).select().single());
}

export async function deleteWorkout(w: Workout) {
  unwrap(await supabase.from("workouts").delete().eq("id", w.id).select());
  if (w.photo_url) await supabase.storage.from("photos").remove([w.photo_url]);
}

export function summaryMessage(r: SaveResult) {
  const k = kcalPerMin(r.workout);
  let msg = `${Math.round(Number(r.workout.calories))} kcal em ${fmtMin(Number(r.workout.duration_min))} · ${fmtDec(k)} kcal/min`;
  if (r.previous) {
    const p = kcalPerMin(r.previous);
    const diff = p > 0 ? ((k - p) / p) * 100 : 0;
    msg += ` (${diff >= 0 ? "+" : ""}${fmtDec(diff)}% vs. anterior)`;
  }
  return msg;
}

/* ---------- Formatting ---------- */

export const fmtDec = (n: number, d = 1) =>
  Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–";
export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export function fmtMin(m: number) {
  const mm = Math.floor(m);
  const ss = Math.round((m - mm) * 60);
  return ss ? `${mm}min${String(ss).padStart(2, "0")}` : `${mm} min`;
}
export function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
