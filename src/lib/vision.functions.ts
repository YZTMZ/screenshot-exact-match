import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkoutReading = {
  date: string | null;
  duration_min: number | null;
  calories: number | null;
  distance_km: number | null;
  avg_speed_kmh: number | null;
  avg_rpm: number | null;
  avg_watts: number | null;
  avg_heart_rate: number | null;
  resistance: number | null;
  confidence: "alta" | "media" | "baixa";
  unreadable_fields: string[];
};

export type ScaleReading = {
  weight_kg: number | null;
  confidence: "alta" | "media" | "baixa";
};

export type ReadResult =
  | { ok: true; kind: "workout"; data: WorkoutReading }
  | { ok: true; kind: "scale"; data: ScaleReading }
  | { ok: false; error: string; retryable: boolean };

const num: any = { type: ["number", "null"] };

const WORKOUT_SCHEMA: any = {
  type: "object",
  additionalProperties: false,
  required: [
    "date", "duration_min", "calories", "distance_km", "avg_speed_kmh", "avg_rpm",
    "avg_watts", "avg_heart_rate", "resistance", "confidence", "unreadable_fields",
  ],
  properties: {
    date: { type: ["string", "null"], description: "AAAA-MM-DD ou null" },
    duration_min: num, calories: num, distance_km: num, avg_speed_kmh: num, avg_rpm: num,
    avg_watts: num, avg_heart_rate: num, resistance: num,
    confidence: { type: "string", enum: ["alta", "media", "baixa"] },
    unreadable_fields: { type: "array", items: { type: "string" } },
  },
};

const SCALE_SCHEMA: any = {
  type: "object",
  additionalProperties: false,
  required: ["weight_kg", "confidence"],
  properties: { weight_kg: num, confidence: { type: "string", enum: ["alta", "media", "baixa"] } },
};

const WORKOUT_PROMPT = `Você lê fotos do painel de bikes de spinning/ergométricas.
Leia os valores exibidos no painel: tempo, calorias (kcal/cal), distância, velocidade, RPM (cadência), watts, frequência cardíaca (bpm/pulse) e nível de resistência.
Regras:
- Tempo em mm:ss ou hh:mm:ss: converta para minutos decimais (ex.: 32:30 -> 32.5).
- Distância em milhas (mi): converta para km (× 1.609344). Velocidade em mph: converta para km/h.
- Use null para qualquer campo que não esteja visível ou legível. NUNCA invente valores.
- Diferencie valores do treino atual de "total acumulado", "odômetro", "ODO" ou "TOTAL" do equipamento; use apenas os do treino atual.
- date: somente se uma data aparecer no painel, senão null.
- unreadable_fields: nomes (em inglês, como no esquema) dos campos esperados que não foram legíveis.
- confidence: "alta" se a leitura está nítida, "media" se há dúvida em algum valor, "baixa" se a foto está ruim ou não mostra um painel.`;

const SCALE_PROMPT = `Você lê fotos de balanças de peso corporal. Retorne o peso exibido em kg (converta de libras se for lb: × 0.45359237).
Use null se não houver uma balança ou o valor não for legível. NUNCA invente valores.`;

export const readPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; kind: "workout" | "scale" }) => {
    if (typeof input?.image !== "string" || !input.image.startsWith("data:image/"))
      throw new Error("Imagem inválida");
    if (input.image.length > 8_000_000) throw new Error("Imagem muito grande");
    if (input.kind !== "workout" && input.kind !== "scale") throw new Error("Tipo inválido");
    return input;
  })
  .handler(async ({ data }): Promise<ReadResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "Leitura por foto não está configurada.", retryable: false };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, jsonSchema } = await import("ai");

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const isWorkout = data.kind === "workout";
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: isWorkout ? WORKOUT_PROMPT : SCALE_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: isWorkout ? "Leia o painel desta bike." : "Leia o peso desta balança." },
              { type: "image", image: new URL(data.image) },
            ],
          },
        ],
        output: Output.object({
          schema: jsonSchema<any>(isWorkout ? WORKOUT_SCHEMA : SCALE_SCHEMA),
        }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const output = await result.output;
      return isWorkout
        ? { ok: true, kind: "workout", data: output as WorkoutReading }
        : { ok: true, kind: "scale", data: output as ScaleReading };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.cause?.statusCode;
      console.error("readPhoto failed", status, e?.message);
      if (status === 402)
        return { ok: false, error: "Os créditos de IA acabaram. Adicione créditos para voltar a ler fotos.", retryable: false };
      if (status === 429)
        return { ok: false, error: "Muitas leituras seguidas. Aguarde alguns segundos e tente de novo.", retryable: true };
      if (status === 403)
        return { ok: false, error: "A leitura por foto está bloqueada nesta conta. Preencha manualmente.", retryable: false };
      return { ok: false, error: "Falha ao ler a foto. Verifique a conexão e tente de novo.", retryable: true };
    }
  });
