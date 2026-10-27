import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bike, Loader2 } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Spin Log" },
      { name: "description", content: "Entre no Spin Log para registrar seus treinos de spinning pela foto do painel." },
      { property: "og:title", content: "Entrar · Spin Log" },
      { property: "og:description", content: "Registre treinos de spinning pela foto do painel da bike." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/painel" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) navigate({ to: "/painel" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "error", text: "E-mail ou senha incorretos. Confira e tente de novo." });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setMsg({ type: "error", text: error.message.includes("Password") ? "A senha precisa ter pelo menos 6 caracteres." : "Não foi possível criar a conta. Confira o e-mail." });
      else setMsg({ type: "info", text: "Conta criada. Abra o link enviado ao seu e-mail para confirmar." });
    }
    setBusy(false);
  };

  const oauth = async (p: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg({ type: "error", text: "Não foi possível entrar. Tente de novo." });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-kcal text-kcal-foreground"><Bike className="h-8 w-8" /></span>
          <h1 className="text-5xl font-bold">Spin Log</h1>
          <p className="text-muted-foreground">Fotografe o painel da bike. O treino se preenche sozinho.</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {msg && <p className={msg.type === "error" ? "text-sm text-destructive" : "text-sm text-success"}>{msg.text}</p>}
            <Button type="submit" variant="kcal" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}{mode === "in" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />ou<div className="h-px flex-1 bg-border" /></div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => oauth("google")}>Continuar com Google</Button>
            <button type="button" className="lovable-auth-button" onClick={() => oauth("lovable")}>Continue with Lovable</button>
          </div>
          <button type="button" className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
            {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
