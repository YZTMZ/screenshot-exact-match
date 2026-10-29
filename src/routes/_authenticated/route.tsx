import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, LayoutDashboard, LogOut, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkoutFlowProvider } from "@/components/WorkoutFlow";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
    // Sem login: cria automaticamente um acesso de visitante neste aparelho.
    const anon = await supabase.auth.signInAnonymously();
    if (anon.error || !anon.data.user) throw redirect({ to: "/auth" });
    return { user: anon.data.user };
  },
  component: AppShell,
});

const TABS = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/treinos", label: "Treinos", icon: Bike },
  { to: "/peso", label: "Peso", icon: Scale },
] as const;

function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <WorkoutFlowProvider>
      <div className="min-h-screen pb-24 md:pb-10">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-kcal text-kcal-foreground"><Bike className="h-5 w-5" /></span>
              Spin Log
            </Link>
            <nav className="ml-6 hidden gap-1 md:flex" aria-label="Principal">
              {TABS.map((t) => (
                <Link key={t.to} to={t.to}
                  className="rounded-lg px-4 py-2 font-display text-lg text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "bg-secondary !text-foreground" }}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-5">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-safe backdrop-blur md:hidden" aria-label="Abas">
          <div className="grid grid-cols-3">
            {TABS.map((t) => (
              <Link key={t.to} to={t.to}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground"
                activeProps={{ className: "!text-kcal" }}>
                <t.icon className="h-6 w-6" />
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </WorkoutFlowProvider>
  );
}
