import {
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";

export const ADMIN_THEME_STORAGE_KEY = "brendon-publishing-theme";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  nav: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  hover: string;
  canvas: string;
  success: string;
  error: string;
};

export type AdminThemeDefinition = {
  id: string;
  name: string;
  description: string;
  mood: string;
  dark: boolean;
  font: string;
  glow: string;
  colors: ThemeColors;
  fluent: Theme;
};

function makeTheme(
  definition: Omit<AdminThemeDefinition, "fluent">,
): AdminThemeDefinition {
  const { colors, dark } = definition;
  const base = dark ? webDarkTheme : webLightTheme;
  const red = Number.parseInt(colors.accent.slice(1, 3), 16);
  const green = Number.parseInt(colors.accent.slice(3, 5), 16);
  const blue = Number.parseInt(colors.accent.slice(5, 7), 16);
  const foregroundOnAccent =
    (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#071017" : "#ffffff";
  return {
    ...definition,
    fluent: {
      ...base,
      colorBrandForeground1: colors.accent,
      colorBrandForeground2: colors.accent,
      colorBrandBackground: colors.accent,
      colorBrandBackground2: colors.accentSoft,
      colorBrandBackgroundHover: colors.accentStrong,
      colorBrandBackgroundPressed: colors.accentStrong,
      colorCompoundBrandForeground1: colors.accent,
      colorCompoundBrandForeground1Hover: colors.accentStrong,
      colorCompoundBrandBackground: colors.accent,
      colorCompoundBrandBackgroundHover: colors.accentStrong,
      colorCompoundBrandBackgroundPressed: colors.accentStrong,
      colorNeutralForegroundOnBrand: foregroundOnAccent,
      colorNeutralForeground1: colors.text,
      colorNeutralForeground2: colors.muted,
      colorNeutralForeground3: colors.muted,
      colorNeutralBackground1: colors.surface,
      colorNeutralBackground2: colors.surfaceAlt,
      colorNeutralBackground3: colors.nav,
      colorNeutralBackground4: colors.hover,
      colorNeutralBackground1Hover: colors.hover,
      colorNeutralStroke1: colors.border,
      colorNeutralStroke2: colors.borderStrong,
      colorPaletteGreenForeground1: colors.success,
      colorPaletteRedForeground1: colors.error,
    },
  };
}

const uiFont = '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const terminalFont = '"Cascadia Code", "SFMono-Regular", Consolas, monospace';

export const adminThemes = [
  makeTheme({
    id: "light",
    name: "Light",
    mood: "The original",
    description: "Clean paper, quiet grays, and the familiar publishing blue.",
    dark: false,
    font: uiFont,
    glow: "none",
    colors: {
      background: "#f5f5f5",
      surface: "#ffffff",
      surfaceAlt: "#fafafa",
      nav: "#fafafa",
      text: "#242424",
      muted: "#616161",
      border: "#e0e0e0",
      borderStrong: "#d1d1d1",
      accent: "#0f6cbd",
      accentStrong: "#0f548c",
      accentSoft: "#eaf3fc",
      hover: "#f0f0f0",
      canvas: "#e9e9e9",
      success: "#0e7c3a",
      error: "#c50f1f",
    },
  }),
  makeTheme({
    id: "dark",
    name: "Dark",
    mood: "Clean and neutral",
    description: "A balanced charcoal workspace for everyday use.",
    dark: true,
    font: uiFont,
    glow: "none",
    colors: {
      background: "#181818",
      surface: "#242424",
      surfaceAlt: "#2b2b2b",
      nav: "#202020",
      text: "#f5f5f5",
      muted: "#b3b3b3",
      border: "#3d3d3d",
      borderStrong: "#505050",
      accent: "#479ef5",
      accentStrong: "#2886de",
      accentSoft: "#17395b",
      hover: "#333333",
      canvas: "#111111",
      success: "#54b87a",
      error: "#ff6b74",
    },
  }),
  makeTheme({
    id: "midnight",
    name: "Midnight",
    mood: "After-hours studio",
    description: "Deep navy surfaces with crisp ice-blue controls.",
    dark: true,
    font: uiFont,
    glow: "0 0 26px rgb(91 192 235 / 10%)",
    colors: {
      background: "#090e17",
      surface: "#111827",
      surfaceAlt: "#162033",
      nav: "#0d1422",
      text: "#eef6ff",
      muted: "#93a4b8",
      border: "#26364d",
      borderStrong: "#354963",
      accent: "#5bc0eb",
      accentStrong: "#2f9fd0",
      accentSoft: "#163a50",
      hover: "#1b2940",
      canvas: "#070b12",
      success: "#54d6a0",
      error: "#ff718b",
    },
  }),
  makeTheme({
    id: "hacker",
    name: "Hacker",
    mood: "Root access",
    description: "Near-black terminal glass and phosphor-green signals.",
    dark: true,
    font: terminalFont,
    glow: "0 0 24px rgb(57 255 20 / 16%)",
    colors: {
      background: "#020503",
      surface: "#071009",
      surfaceAlt: "#0a160d",
      nav: "#030a05",
      text: "#b7ffb0",
      muted: "#67a66d",
      border: "#17451f",
      borderStrong: "#247331",
      accent: "#39ff14",
      accentStrong: "#20c908",
      accentSoft: "#103817",
      hover: "#102616",
      canvas: "#010301",
      success: "#39ff14",
      error: "#ff4f64",
    },
  }),
  makeTheme({
    id: "dracula",
    name: "Dracula",
    mood: "Elegant nocturne",
    description: "Charcoal violet with electric purple and pink highlights.",
    dark: true,
    font: uiFont,
    glow: "0 0 28px rgb(189 147 249 / 16%)",
    colors: {
      background: "#191a26",
      surface: "#282a36",
      surfaceAlt: "#303241",
      nav: "#21222c",
      text: "#f8f8f2",
      muted: "#a7a8bd",
      border: "#44475a",
      borderStrong: "#5b5f78",
      accent: "#bd93f9",
      accentStrong: "#9f6ee8",
      accentSoft: "#47385f",
      hover: "#383a4a",
      canvas: "#14151f",
      success: "#50fa7b",
      error: "#ff5555",
    },
  }),
  makeTheme({
    id: "nord",
    name: "Nord",
    mood: "Arctic focus",
    description: "Calm polar blues designed for long editing sessions.",
    dark: true,
    font: uiFont,
    glow: "0 0 24px rgb(136 192 208 / 12%)",
    colors: {
      background: "#242933",
      surface: "#2e3440",
      surfaceAlt: "#353c4a",
      nav: "#292f3b",
      text: "#eceff4",
      muted: "#a9b4c6",
      border: "#465063",
      borderStrong: "#59677c",
      accent: "#88c0d0",
      accentStrong: "#5e9fb3",
      accentSoft: "#344e5a",
      hover: "#3b4352",
      canvas: "#20242d",
      success: "#a3be8c",
      error: "#bf616a",
    },
  }),
  makeTheme({
    id: "solarized",
    name: "Solarized",
    mood: "Scholar's terminal",
    description: "Low-contrast ink tones with cyan and golden accents.",
    dark: true,
    font: uiFont,
    glow: "none",
    colors: {
      background: "#002b36",
      surface: "#073642",
      surfaceAlt: "#0b3f4b",
      nav: "#00333f",
      text: "#eee8d5",
      muted: "#93a1a1",
      border: "#175463",
      borderStrong: "#2a6875",
      accent: "#2aa198",
      accentStrong: "#16877f",
      accentSoft: "#164e50",
      hover: "#104753",
      canvas: "#00242d",
      success: "#859900",
      error: "#dc322f",
    },
  }),
  makeTheme({
    id: "ocean",
    name: "Ocean Depths",
    mood: "Bioluminescent",
    description: "Abyssal blue with bright aqua wayfinding.",
    dark: true,
    font: uiFont,
    glow: "0 0 30px rgb(0 229 255 / 16%)",
    colors: {
      background: "#03131f",
      surface: "#072538",
      surfaceAlt: "#0b3045",
      nav: "#051d2c",
      text: "#e7fbff",
      muted: "#83b8c5",
      border: "#12465d",
      borderStrong: "#1d6078",
      accent: "#00e5ff",
      accentStrong: "#00afc6",
      accentSoft: "#0a4b59",
      hover: "#0c394f",
      canvas: "#020d16",
      success: "#51f0bc",
      error: "#ff657a",
    },
  }),
  makeTheme({
    id: "sakura",
    name: "Sakura",
    mood: "Soft editorial",
    description: "Warm ivory, cherry-blossom pink, and plum ink.",
    dark: false,
    font: uiFont,
    glow: "0 10px 30px rgb(183 91 122 / 10%)",
    colors: {
      background: "#fff7f8",
      surface: "#fffdfb",
      surfaceAlt: "#fff0f3",
      nav: "#fcebee",
      text: "#4a2934",
      muted: "#876572",
      border: "#f0d5dc",
      borderStrong: "#ddb8c3",
      accent: "#c94f7c",
      accentStrong: "#a83a63",
      accentSoft: "#f9dce6",
      hover: "#fbe5eb",
      canvas: "#f4e4e8",
      success: "#438a65",
      error: "#bc354f",
    },
  }),
  makeTheme({
    id: "espresso",
    name: "Espresso",
    mood: "Late café",
    description: "Roasted browns, cream type, and a caramel accent.",
    dark: true,
    font: uiFont,
    glow: "0 8px 28px rgb(214 155 80 / 12%)",
    colors: {
      background: "#1a120d",
      surface: "#2b1d15",
      surfaceAlt: "#35251b",
      nav: "#21160f",
      text: "#f7ead7",
      muted: "#bda88e",
      border: "#503a2b",
      borderStrong: "#6a4e39",
      accent: "#d69b50",
      accentStrong: "#b67831",
      accentSoft: "#553a20",
      hover: "#402d21",
      canvas: "#130d09",
      success: "#8fbe78",
      error: "#e46e5c",
    },
  }),
  makeTheme({
    id: "synthwave",
    name: "Synthwave",
    mood: "Neon sunset",
    description: "Electric magenta, cyan sparks, and arcade-night purple.",
    dark: true,
    font: uiFont,
    glow: "0 0 30px rgb(255 45 149 / 22%)",
    colors: {
      background: "#10051f",
      surface: "#21103b",
      surfaceAlt: "#2b154a",
      nav: "#180a2c",
      text: "#fff1ff",
      muted: "#c4a8d8",
      border: "#55306f",
      borderStrong: "#794197",
      accent: "#ff2d95",
      accentStrong: "#d71978",
      accentSoft: "#5a1747",
      hover: "#371d55",
      canvas: "#0b0315",
      success: "#36f1cd",
      error: "#ff5e73",
    },
  }),
  makeTheme({
    id: "amber",
    name: "Amber CRT",
    mood: "1983 mainframe",
    description: "Warm amber phosphor on a smoky vintage terminal.",
    dark: true,
    font: terminalFont,
    glow: "0 0 24px rgb(255 176 0 / 18%)",
    colors: {
      background: "#120d03",
      surface: "#1d1608",
      surfaceAlt: "#281e0a",
      nav: "#171004",
      text: "#ffe5a3",
      muted: "#b98b36",
      border: "#5a3e0d",
      borderStrong: "#805814",
      accent: "#ffb000",
      accentStrong: "#d58d00",
      accentSoft: "#533808",
      hover: "#34260d",
      canvas: "#0c0902",
      success: "#c7d94c",
      error: "#ff6542",
    },
  }),
  makeTheme({
    id: "blueprint",
    name: "Blueprint",
    mood: "Systems architect",
    description: "Technical cobalt, drafting-paper lines, and white ink.",
    dark: true,
    font: terminalFont,
    glow: "0 0 22px rgb(111 195 255 / 14%)",
    colors: {
      background: "#071d36",
      surface: "#0b2c50",
      surfaceAlt: "#10385f",
      nav: "#082443",
      text: "#eff8ff",
      muted: "#a0c6df",
      border: "#24527a",
      borderStrong: "#376f9e",
      accent: "#6fc3ff",
      accentStrong: "#42a2e5",
      accentSoft: "#174c73",
      hover: "#143f68",
      canvas: "#05172b",
      success: "#7fe0b6",
      error: "#ff7589",
    },
  }),
] as const;

export type AdminThemeId = (typeof adminThemes)[number]["id"];

export function isAdminThemeId(value: string): value is AdminThemeId {
  return adminThemes.some((theme) => theme.id === value);
}

export function getAdminTheme(id: AdminThemeId) {
  return adminThemes.find((theme) => theme.id === id) ?? adminThemes[0];
}

export function readStoredAdminTheme(): AdminThemeId {
  try {
    const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY) || "";
    return isAdminThemeId(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function applyAdminTheme(theme: AdminThemeDefinition) {
  const root = document.documentElement;
  root.dataset.adminTheme = theme.id;
  root.style.colorScheme = theme.dark ? "dark" : "light";
  root.style.setProperty("--admin-font", theme.font);
  root.style.setProperty("--admin-glow", theme.glow);
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    root.style.setProperty(`--admin-${cssKey}`, value);
  });
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme.id);
  } catch {
    // Theme switching still works for this session when storage is unavailable.
  }
}
