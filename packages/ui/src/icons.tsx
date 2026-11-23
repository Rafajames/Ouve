import type { SVGProps } from "react";

/** Ícones de traço próprios do Ouve (24×24), sem dependência externa. */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  record: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  upload: "M12 15V3m0 0-4 4m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  transcript: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
  report: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  providers: "M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10",
  settings: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  window: "M3 4h18v16H3zM3 9h18M7 6.5h.01M10 6.5h.01",
  tab: "M3 8h7l2-3h9v15H3zM3 8v12",
  mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v4",
  micOff: "M2 2l20 20M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.7 6M12 18v4",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l13 8-13 8z",
  stop: "M6 6h12v12H6z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  download: "M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  refresh: "M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5",
  plus: "M12 5v14M5 12h14",
  check: "M4 12l5 5L20 6",
  alert: "M12 3 2 21h20zM12 10v4M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01",
  sparkles: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  shield: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  wave: "M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0",
  x: "M6 6l12 12M18 6 6 18",
  chevron: "M9 6l6 6-6 6",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01",
  cpu: "M6 6h12v12H6zM9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  sidebar: "M3 4h18v16H3zM9 4v16",
  sort: "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 6l-6 6 6 6",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  library: "M5 3h10l4 4v14H5zM15 3v4h4M9 12h6M9 16h6M9 8h2",
  key: "M15 9a3 3 0 1 0 0-.01M13 11l-9 9M7 17l2 2M10 14l2 2",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  palette: "M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM7.5 11h.01M10.5 7h.01M15 7.5h.01",
  volume: "M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4"
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Marca do Ouve: um “O” que escuta — anel com ondas sonoras no centro, na cor de destaque do tema. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="brand-mark">
      <rect width="40" height="40" rx="10" style={{ fill: "var(--accent, #0f766e)" }} />
      <circle cx="20" cy="20" r="11" fill="none" strokeWidth="2.4" style={{ stroke: "var(--on-accent, #fff)", opacity: 0.35 }} />
      <path
        d="M14.5 20v0M17.25 16.5v7M20 13.5v13M22.75 16v8M25.5 19v2"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ stroke: "var(--on-accent, #fff)" }}
      />
    </svg>
  );
}
