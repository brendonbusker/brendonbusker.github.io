const SAFE_REPO_PATHS = [
  /^apps\/site\/src\/content\/posts\/[a-z0-9-]+\.md$/,
  /^apps\/site\/src\/content\/projects\/[a-z0-9-]+\.md$/,
  /^apps\/site\/src\/data\/(site|resume|appearance)\.json$/,
  /^apps\/site\/public\/uploads\/(posts|projects)\/[a-z0-9-]+\/[a-z0-9-]+\.(?:jpe?g|png|webp|avif)$/,
  /^apps\/site\/public\/resume\/Brendon-Busker-Resume\.pdf$/,
  /^apps\/site\/public\/content-version\.json$/
];
export function isAllowedRepositoryPath(path: string) {
  if (path.includes('..') || path.includes('\\') || path.includes('\0') || path.startsWith('.github/')) return false;
  return SAFE_REPO_PATHS.some((pattern) => pattern.test(path));
}
export function assertSafeExternalUrl(value: string) {
  const parsed = new URL(value);
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error('Unsafe URL protocol');
  return value;
}
export function sanitizeFilename(value: string) { return value.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/-+/g, '-').slice(0, 96); }
export function timingSafeEqualText(a: string, b: string) {
  const left = new TextEncoder().encode(a); const right = new TextEncoder().encode(b); let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  return diff === 0;
}
