// Pure calculation rules for Spin Log (no I/O).

export type ChallengeType = "pace" | "duration" | "total_kcal" | "frequency";
export type ChallengeStatus = "open" | "done" | "missed";

export interface WorkoutLike {
  id?: string | undefined;
  date: string; // YYYY-MM-DD
  duration_min: number;
  calories: number;
}

export interface ChallengeDraft {
  type: ChallengeType;
  title: string;
  target_value: number;
  unit: string;
}

export interface ChallengeLike extends ChallengeDraft {
  id: string;
  status: ChallengeStatus;
  created_date: string;
}

export const KCAL_PER_KG = 7700;
export const MAX_CHALLENGE_DURATION = 45;

export function kcalPerMin(w: { calories: number; duration_min: number }): number {
  if (!w.duration_min || w.duration_min <= 0) return 0;
  return Number(w.calories) / Number(w.duration_min);
}

export function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function parseDate(d: string): Date {
  const [y = 1970, m = 1, day = 1] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

/** Monday (YYYY-MM-DD) of the week containing date. Weeks start on Monday. */
export function weekStart(date: string): string {
  const dt = parseDate(date);
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

/** Converts "mm:ss" or "hh:mm:ss" (or a number) into decimal minutes. */
export function parseDuration(v: string | number): number | null {
  if (typeof v === "number") return v;
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  if (!s.includes(":")) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const parts = s.split(":").map(Number) as number[];
  const [a = 0, b = 0, c = 0] = parts;
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 2) return round(a + b / 60, 2);
  if (parts.length === 3) return round(a * 60 + b + c / 60, 2);
  return null;
}

export function milesToKm(mi: number) {
  return round(mi * 1.609344, 2);
}

/** Challenges generated from the last saved workout. */
export function generateChallenges(last: WorkoutLike): ChallengeDraft[] {
  const pace = round(kcalPerMin(last) * 1.05, 2);
  const duration = Math.min(Math.round(Number(last.duration_min) + 5), MAX_CHALLENGE_DURATION);
  const total = Math.round(pace * duration);
  return [
    { type: "pace", title: `Ritmo de ${pace.toFixed(1).replace(".", ",")} kcal/min`, target_value: pace, unit: "kcal/min" },
    { type: "duration", title: `Pedalar ${duration} minutos`, target_value: duration, unit: "min" },
    { type: "total_kcal", title: `Queimar ${total} kcal`, target_value: total, unit: "kcal" },
    { type: "frequency", title: "3 treinos nesta semana", target_value: 3, unit: "treinos" },
  ];
}

export const INITIAL_CHALLENGES = [
  "Pedalar 30 minutos sem pausas longas",
  "Fotografar o painel da bike no final",
  "Fazer 3 treinos nesta semana",
];

/**
 * Evaluates an open challenge against a newly saved workout.
 * Returns null when the challenge should remain open (frequency still in progress).
 */
export function evaluateChallenge(
  c: { type: string; target_value: number; created_date: string },
  w: WorkoutLike,
  workoutsInWeekOfNew: number,
): ChallengeStatus | null {
  const t = Number(c.target_value);
  switch (c.type) {
    case "pace":
      return kcalPerMin(w) >= t ? "done" : "missed";
    case "duration":
      return Number(w.duration_min) >= t ? "done" : "missed";
    case "total_kcal":
      return Number(w.calories) >= t ? "done" : "missed";
    case "frequency": {
      const createdWeek = weekStart(c.created_date.slice(0, 10));
      const newWeek = weekStart(w.date);
      if (newWeek === createdWeek && workoutsInWeekOfNew >= t) return "done";
      if (newWeek > createdWeek) return workoutsInWeekOfNew >= t ? "done" : "missed";
      return null;
    }
  }
}

export interface ValueWarning {
  field: string;
  message: string;
}

export function sanityWarnings(w: { duration_min?: number | null; calories?: number | null }): ValueWarning[] {
  const out: ValueWarning[] = [];
  if (w.duration_min != null && w.duration_min > 180)
    out.push({ field: "duration_min", message: "Duração acima de 180 min. Confira se não é o total acumulado da bike." });
  if (w.calories != null && w.calories > 2000)
    out.push({ field: "calories", message: "Mais de 2.000 kcal. Confira se não é o total acumulado da bike." });
  return out;
}

export function isDuplicate(a: WorkoutLike, list: WorkoutLike[]) {
  return list.some(
    (b) =>
      b.id !== a.id &&
      b.date === a.date &&
      Number(b.duration_min) === Number(a.duration_min) &&
      Number(b.calories) === Number(a.calories),
  );
}

export function weightValid(kg: number) {
  return Number.isFinite(kg) && kg >= 20 && kg <= 400;
}

export function workoutsRemaining(currentKg: number, targetKg: number, avgKcalPerWorkout: number) {
  const toLose = currentKg - targetKg;
  if (toLose <= 0 || avgKcalPerWorkout <= 0) return 0;
  return Math.ceil((toLose * KCAL_PER_KG) / avgKcalPerWorkout);
}

export function kgPerWeekNeeded(currentKg: number, targetKg: number, deadline: string, today: string) {
  const days = (parseDate(deadline).getTime() - parseDate(today).getTime()) / 86400000;
  const toLose = currentKg - targetKg;
  if (toLose <= 0) return 0;
  if (days <= 0) return Infinity;
  return toLose / (days / 7);
}
