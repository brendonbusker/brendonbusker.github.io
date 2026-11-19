import { describe, expect, it } from 'vitest';
import { getProjectIcon, projectIcons, projectSchema } from '.';

describe('project icons', () => {
  it('keeps published icon paths unchanged', () => {
    expect(getProjectIcon('folder').paths).toEqual(['M3 6h6l2 2h10v11H3z']);
    expect(getProjectIcon('calculator').paths).toEqual([
      'M4 2h16v20H4z', 'M8 6h8v4H8z', 'M8 14h.01', 'M12 14h.01',
      'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01',
    ]);
    expect(getProjectIcon('sparkles').paths).toEqual([
      'M12 3l1.35 3.65L17 8l-3.65 1.35L12 13l-1.35-3.65L7 8l3.65-1.35z',
      'M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
      'M5 13l.95 2.55L8.5 16.5l-2.55.95L5 20l-.95-2.55-2.55-.95 2.55-.95z',
    ]);
  });

  it('provides distinct selectable icons including a game controller', () => {
    expect(new Set(projectIcons.map(icon => icon.value)).size).toBe(projectIcons.length);
    expect(getProjectIcon('gamepad')).toMatchObject({ value: 'gamepad', label: 'Game controller' });
    for (const icon of projectIcons) {
      expect(projectSchema.shape.icon.parse(icon.value)).toBe(icon.value);
      expect(getProjectIcon(icon.value)).toBe(icon);
      expect(icon.label.trim()).not.toBe('');
      expect(icon.paths.length).toBeGreaterThan(0);
    }
  });

  it('renders unknown stored values as folders without rejecting or rewriting them', () => {
    for (const value of ['future-icon', '__proto__', 'constructor', 'toString']) {
      expect(projectSchema.shape.icon.parse(value)).toBe(value);
      expect(getProjectIcon(value)).toBe(getProjectIcon('folder'));
    }
    expect(getProjectIcon('')).toBe(getProjectIcon('folder'));
  });
});
