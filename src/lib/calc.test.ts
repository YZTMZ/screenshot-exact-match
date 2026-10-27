import { describe, expect, it } from "vitest";
import {
  evaluateChallenge,
  generateChallenges,
  isDuplicate,
  kcalPerMin,
  parseDuration,
  weekStart,
  weightValid,
  workoutsRemaining,
} from "./calc";

describe("regras do Spin Log", () => {
  it("kcal/min = calorias / minutos", () => {
    expect(kcalPerMin({ calories: 300, duration_min: 30 })).toBe(10);
  });

  it("semana começa na segunda-feira", () => {
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // domingo
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // segunda
  });

  it("converte mm:ss e hh:mm:ss em minutos", () => {
    expect(parseDuration("30:30")).toBe(30.5);
    expect(parseDuration("1:05:00")).toBe(65);
  });

  it("desafio de ritmo = último kcal/min × 1,05", () => {
    const c = generateChallenges({ date: "2026-10-26", duration_min: 30, calories: 300 });
    expect(c.find((x) => x.type === "pace")!.target_value).toBe(10.5);
  });

  it("desafio de duração = último + 5 min, limite 45", () => {
    expect(generateChallenges({ date: "2026-10-26", duration_min: 30, calories: 300 }).find((x) => x.type === "duration")!.target_value).toBe(35);
    expect(generateChallenges({ date: "2026-10-26", duration_min: 42, calories: 300 }).find((x) => x.type === "duration")!.target_value).toBe(45);
  });

  it("desafio total = round(meta kcal/min × duração do desafio)", () => {
    const c = generateChallenges({ date: "2026-10-26", duration_min: 30, calories: 300 });
    expect(c.find((x) => x.type === "total_kcal")!.target_value).toBe(368); // 10.5 * 35 = 367.5
  });

  it("frequência: 3 treinos na semana", () => {
    const c = generateChallenges({ date: "2026-10-26", duration_min: 30, calories: 300 });
    expect(c.find((x) => x.type === "frequency")!.target_value).toBe(3);
  });

  it("marca ritmo como cumprido ou perdido", () => {
    const ch = { type: "pace" as const, target_value: 10.5, created_date: "2026-10-26" };
    expect(evaluateChallenge(ch, { date: "2026-10-27", duration_min: 30, calories: 330 }, 2)).toBe("done");
    expect(evaluateChallenge(ch, { date: "2026-10-27", duration_min: 30, calories: 300 }, 2)).toBe("missed");
  });

  it("frequência fica aberta durante a semana e é perdida na semana seguinte", () => {
    const ch = { type: "frequency" as const, target_value: 3, created_date: "2026-10-26" };
    expect(evaluateChallenge(ch, { date: "2026-10-27", duration_min: 30, calories: 300 }, 2)).toBeNull();
    expect(evaluateChallenge(ch, { date: "2026-10-28", duration_min: 30, calories: 300 }, 3)).toBe("done");
    expect(evaluateChallenge(ch, { date: "2026-11-03", duration_min: 30, calories: 300 }, 1)).toBe("missed");
  });

  it("detecta duplicidade por data, duração e calorias", () => {
    const list = [{ id: "a", date: "2026-10-26", duration_min: 30, calories: 300 }];
    expect(isDuplicate({ date: "2026-10-26", duration_min: 30, calories: 300 }, list)).toBe(true);
    expect(isDuplicate({ date: "2026-10-26", duration_min: 31, calories: 300 }, list)).toBe(false);
  });

  it("peso aceito entre 20 e 400 kg", () => {
    expect(weightValid(19.9)).toBe(false);
    expect(weightValid(400)).toBe(true);
    expect(weightValid(401)).toBe(false);
  });

  it("treinos restantes usando 7.700 kcal por kg", () => {
    expect(workoutsRemaining(80, 78, 385)).toBe(40);
  });
});
