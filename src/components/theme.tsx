import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "spinlog-theme";

function apply(mode: "light" | "dark" | null) {
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode ? mode === "dark" : sys;
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

export function useThemeInit() {
  useEffect(() => {
    const saved = localStorage.getItem(KEY) as "light" | "dark" | null;
    apply(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply(localStorage.getItem(KEY) as "light" | "dark" | null);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <Button
      variant="ghost" size="icon" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        localStorage.setItem(KEY, next);
        setDark(apply(next));
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
