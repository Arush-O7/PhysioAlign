export const THEMES = ['sunshine', 'orchid', 'midnight'] as const;
export type Theme = (typeof THEMES)[number];

const KEY = 'physioalign:theme';

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved && THEMES.includes(saved)) return saved;
  } catch {
    // private browsing, fall through to the default
  }
  return 'sunshine';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // not being able to remember the choice shouldn't break the app
  }
}
