import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bike, Camera, LineChart, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spin Log · Treinos de spinning pela foto do painel" },
      { name: "description", content: "Tire uma foto do painel da bike e o Spin Log registra calorias, tempo e desempenho. Gráficos, desafios e meta de peso." },
      { property: "og:title", content: "Spin Log · Treinos de spinning pela foto do painel" },
      { property: "og:description", content: "Fotografe o painel da bike e acompanhe calorias, evolução, desafios e meta de peso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/painel", replace: true });
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="flex items-center gap-2 font-display text-2xl font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-kcal text-kcal-foreground"><Bike className="h-5 w-5" /></span>
        Spin Log
      </div>
      <h1 className="text-6xl font-bold leading-[0.95]">Pedalou?<br /><span className="text-kcal">Foto no painel.</span></h1>
      <p className="text-lg text-muted-foreground">A gente lê tempo, calorias, RPM e watts da foto. Você só confere e salva.</p>
      <ul className="flex flex-col gap-3">
        {[
          { icon: Camera, t: "Treino preenchido pela foto", c: "text-kcal" },
          { icon: LineChart, t: "Evolução de kcal/min e por semana", c: "text-time" },
          { icon: Target, t: "Desafios e meta de peso", c: "text-success" },
        ].map((i) => (
          <li key={i.t} className="flex items-center gap-3 rounded-xl border bg-card p-3"><i.icon className={`h-5 w-5 ${i.c}`} />{i.t}</li>
        ))}
      </ul>
      <Button asChild variant="kcal" size="lg"><Link to="/auth">Começar</Link></Button>
    </div>
  );
}
