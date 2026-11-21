export type ThemePreference = "system" | "light" | "dark";

/** Aplica o tema no elemento raiz; "system" segue prefers-color-scheme via CSS. */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
