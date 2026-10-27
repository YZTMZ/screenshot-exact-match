CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  date date NOT NULL DEFAULT current_date,
  duration_min numeric NOT NULL,
  calories numeric NOT NULL,
  distance_km numeric, avg_speed_kmh numeric, avg_rpm numeric, avg_watts numeric,
  avg_heart_rate numeric, resistance numeric,
  photo_url text, source text NOT NULL DEFAULT 'manual' CHECK (source IN ('photo','manual')),
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workouts" ON public.workouts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  date date NOT NULL DEFAULT current_date,
  weight_kg numeric NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
  photo_url text, source text NOT NULL DEFAULT 'manual' CHECK (source IN ('photo','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_entries TO authenticated;
GRANT ALL ON public.weight_entries TO service_role;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weights" ON public.weight_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.weight_goals (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  start_weight_kg numeric NOT NULL CHECK (start_weight_kg BETWEEN 20 AND 400),
  target_weight_kg numeric NOT NULL CHECK (target_weight_kg BETWEEN 20 AND 400),
  deadline date,
  created_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_goals TO authenticated;
GRANT ALL ON public.weight_goals TO service_role;
ALTER TABLE public.weight_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goal" ON public.weight_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  workout_id_base uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('pace','duration','total_kcal','frequency')),
  title text NOT NULL, target_value numeric NOT NULL, unit text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','missed')),
  created_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges" ON public.challenges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own photos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own photos insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own photos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);