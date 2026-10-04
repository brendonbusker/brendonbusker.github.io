import { expect, it } from 'vitest';
import { recipeIndexContent } from './recipe-content';
import { formatRecipeTime, recipeMeal } from './recipes';

it('indexes readable words and selects the first safe image without exposing active markup', async () => {
  const content = await recipeIndexContent('<h2>Ingredients</h2><p>Cr&egrave;me &amp; lemon</p><script>privateScriptToken()</script><img src="javascript:alert(1)" alt="Bad"><img src="/uploads/recipes/lemon/animated.gif" alt="Lemon &amp; cream" onerror="alert(2)"><img src="https://example.com/later.jpg">');
  expect(content.searchHtml).toContain('Ingredients ');
  expect(content.searchHtml.replace(/\s+/g, ' ')).toContain('Crème &amp; lemon');
  expect(content.searchHtml).not.toMatch(/script|img|alert|privateScriptToken/);
  expect(content.cover).toEqual({ src: '/uploads/recipes/lemon/animated.gif', alt: 'Lemon & cream' });
});

it('accepts Markdown images and keeps recipes without images searchable', async () => {
  expect((await recipeIndexContent('## Ingredients\n\n- Flour\n- Eggs')).cover).toBeUndefined();
  expect((await recipeIndexContent('![Fresh bread](/uploads/recipes/bread/loaf.webp)')).cover).toEqual({ src: '/uploads/recipes/bread/loaf.webp', alt: 'Fresh bread' });
  expect((await recipeIndexContent('<img src="data:image/png;base64,123"><img src="//example.com/a.png">')).cover).toBeUndefined();
});

it('restores only supported meal filters and formats optional times without hiding zero', () => {
  expect(recipeMeal('breakfast')).toBe('breakfast');
  expect(recipeMeal('other')).toBe('');
  expect(recipeMeal(null)).toBe('');
  expect(formatRecipeTime(0)).toBe('0 min');
  expect(formatRecipeTime(55)).toBe('55 min');
  expect(formatRecipeTime(60)).toBe('1 hr');
  expect(formatRecipeTime(90)).toBe('1 hr 30 min');
});
