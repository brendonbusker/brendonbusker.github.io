import type { Recipe } from '@brendon/shared';

export type RecipeMeal = Recipe['meals'][number];
export const mealLabels: Record<RecipeMeal, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

export function recipeMeal(value: string | null): RecipeMeal | '' {
  return value && Object.hasOwn(mealLabels, value) ? value as RecipeMeal : '';
}

export function formatRecipeTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} hr${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`;
}
