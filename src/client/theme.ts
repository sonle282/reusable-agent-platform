import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "admin-theme";
const darkQuery = () => window.matchMedia?.("(prefers-color-scheme: dark)");

export function readThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return darkQuery()?.matches ? "dark" : "light";
}

// The owner's stored choice wins; otherwise follow the OS and keep following it while the app is open.
// The resolved theme is also set on <html> so the page ground and legacy token aliases match.
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readThemeChoice);
  const [theme, setTheme] = useState<Theme>(() => resolve(choice));
  useEffect(() => {
    const apply = () => setTheme(resolve(choice));
    apply();
    if (choice !== "system") return;
    const query = darkQuery();
    query?.addEventListener("change", apply);
    return () => query?.removeEventListener("change", apply);
  }, [choice]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const setChoice = (next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
    setChoiceState(next);
  };
  return { choice, theme, setChoice };
}
