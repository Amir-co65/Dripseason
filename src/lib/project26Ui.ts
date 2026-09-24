export type Project26Ui = {
  theme: "system" | "light" | "dark";
  accent: "mono" | "blue" | "green" | "orange" | "purple" | "rose";
  density: "comfortable" | "compact";
  fontSize: "small" | "normal" | "large";
  sidebar: "expanded" | "compact";
  radius: "round" | "sharp";
  currency: string;
  maskSensitive: boolean;
};

export const defaultProject26Ui: Project26Ui = {
  theme: "system", accent: "blue", density: "comfortable", fontSize: "normal",
  sidebar: "expanded", radius: "round", currency: "€", maskSensitive: true,
};

const accentColors: Record<Project26Ui["accent"], string | null> = {
  mono: null, blue: "#4b5fb5", green: "#1a7f4b", orange: "#d9541e", purple: "#7a4fe0", rose: "#d6336c",
};

export function readProject26Ui(value: unknown): Project26Ui {
  if (!value || typeof value !== "object") return defaultProject26Ui;
  const source = value as Partial<Project26Ui>;
  return { ...defaultProject26Ui, ...source };
}

export function applyProject26Ui(ui: Project26Ui) {
  const root = document.documentElement;
  if (ui.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", ui.theme);
  const accent = accentColors[ui.accent];
  if (accent) {
    root.style.setProperty("--p26-accent", accent);
    root.style.setProperty("--p26-accent-fg", "#fff");
  } else {
    root.style.removeProperty("--p26-accent");
    root.style.removeProperty("--p26-accent-fg");
  }
  root.style.setProperty("--p26-font-size", { small: "13px", normal: "14px", large: "16px" }[ui.fontSize]);
  root.style.setProperty("--p26-radius", ui.radius === "sharp" ? "2px" : "8px");
  root.dataset.density = ui.density;
  root.dataset.sidebar = ui.sidebar;
}
