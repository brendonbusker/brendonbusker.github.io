const folderIcon = {
  value: 'folder',
  label: 'Folder',
  paths: ['M3 6h6l2 2h10v11H3z'],
} as const;

/** Shared 24 × 24 outline icons for the project editor and public project cards. */
export const projectIcons = [
  {
    value: 'sparkles',
    label: 'Sparkles',
    paths: [
      'M12 3l1.35 3.65L17 8l-3.65 1.35L12 13l-1.35-3.65L7 8l3.65-1.35z',
      'M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
      'M5 13l.95 2.55L8.5 16.5l-2.55.95L5 20l-.95-2.55-2.55-.95 2.55-.95z',
    ],
  },
  folderIcon,
  {
    value: 'calculator',
    label: 'Calculator',
    paths: ['M4 2h16v20H4z', 'M8 6h8v4H8z', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  },
  {
    value: 'gamepad',
    label: 'Game controller',
    paths: [
      'M7 6h10c2 0 3 1.8 3.5 4l1.2 6c.5 2.5-1.7 4-3.4 2.3L15.5 16h-7l-2.8 2.3C4 20 1.8 18.5 2.3 16l1.2-6C4 7.8 5 6 7 6Z',
      'M6 11h4', 'M8 9v4', 'M16 10h.01', 'M18 12h.01',
    ],
  },
  {
    value: 'code',
    label: 'Code',
    paths: ['M7 6l-5 6 5 6', 'M17 6l5 6-5 6', 'M14 3 10 21'],
  },
  {
    value: 'terminal',
    label: 'Terminal',
    paths: ['M3 4h18v16H3z', 'M6 8l4 4-4 4', 'M13 16h5'],
  },
  {
    value: 'globe',
    label: 'Globe',
    paths: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M2 12h20', 'M12 2c-5 5-5 15 0 20 5-5 5-15 0-20Z'],
  },
  {
    value: 'monitor',
    label: 'Monitor',
    paths: ['M2 3h20v14H2z', 'M12 17v4', 'M8 21h8'],
  },
  {
    value: 'smartphone',
    label: 'Smartphone',
    paths: ['M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z', 'M10 5h4', 'M12 19h.01'],
  },
  {
    value: 'bot',
    label: 'Robot',
    paths: ['M5 7h14v13H5z', 'M12 3v4', 'M12 2h.01', 'M2 11v5', 'M22 11v5', 'M9 12h.01', 'M15 12h.01', 'M9 16h6'],
  },
  {
    value: 'wrench',
    label: 'Tools',
    paths: ['M14 3a6 6 0 0 0-7 8L2.5 17.5a2.8 2.8 0 0 0 4 4L13 15a6 6 0 0 0 8-7l-4 4-5-5 4-4Z', 'M5 19h.01'],
  },
  {
    value: 'palette',
    label: 'Art palette',
    paths: ['M12 2a10 10 0 0 0 0 20h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a4 4 0 0 0 4-4A10 10 0 0 0 12 2Z', 'M7 8h.01', 'M12 6h.01', 'M17 8h.01', 'M6 13h.01'],
  },
  {
    value: 'camera',
    label: 'Camera',
    paths: ['M3 7h4l2-3h6l2 3h4v13H3z', 'M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  },
  {
    value: 'music',
    label: 'Music',
    paths: ['M9 18V5l11-3v13', 'M9 9l11-3', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  },
  {
    value: 'book',
    label: 'Book',
    paths: ['M12 5C9 3 6 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z', 'M12 5v15'],
  },
  {
    value: 'chart',
    label: 'Chart',
    paths: ['M3 3v18h18', 'M7 17v-5', 'M12 17V7', 'M17 17V4'],
  },
  {
    value: 'database',
    label: 'Database',
    paths: ['M21 5c0 1.7-4 3-9 3S3 6.7 3 5s4-3 9-3 9 1.3 9 3Z', 'M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5', 'M3 12c0 1.7 4 3 9 3s9-1.3 9-3'],
  },
  {
    value: 'shield',
    label: 'Shield',
    paths: ['M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6Z', 'M8 12l3 3 5-6'],
  },
  {
    value: 'rocket',
    label: 'Rocket',
    paths: ['M9 15c1-6 5-11 12-12 0 7-5 11-11 12Z', 'M9 9H5l-3 5 6 1', 'M15 15v4l-5 3-1-6', 'M17 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z', 'M6 18l-3 3'],
  },
  {
    value: 'puzzle',
    label: 'Puzzle',
    paths: ['M4 4h5a3 3 0 1 1 6 0h5v5a3 3 0 1 1 0 6v5h-5a3 3 0 1 0-6 0H4v-5a3 3 0 1 0 0-6Z'],
  },
  {
    value: 'keyboard',
    label: 'Keyboard',
    paths: ['M2 5h20v14H2z', 'M6 9h.01', 'M10 9h.01', 'M14 9h.01', 'M18 9h.01', 'M6 12h.01', 'M10 12h.01', 'M14 12h.01', 'M18 12h.01', 'M6 16h12'],
  },
] as const;

export type ProjectIcon = (typeof projectIcons)[number];

/** Keep older or unknown stored values renderable without rewriting project content. */
export function getProjectIcon(value: string): ProjectIcon {
  return projectIcons.find(icon => icon.value === value) ?? folderIcon;
}
