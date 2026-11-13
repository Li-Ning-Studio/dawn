import type { Answers, FinderConfig, LiveProduct, Messages } from './config.ts';
import { cleanAnswers } from './engine.ts';

export const storageKey = 'hndrd-racket-finder';

export function readSaved(config: FinderConfig): Answers {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    // These known older versions use compatible answer IDs. New questions do
    // not invalidate the remaining answers; the UI resumes at the first gap.
    const previousQuiz = /^2\.0\.0(?:-[a-z0-9]+)?$/.test(saved?.version || '') && config.version === '3.0.0';
    const previousV3 = config.version === '3.0.0' && /^3\.0\.0-[a-z0-9]+$/.test(saved?.version || '');
    if (saved?.version !== config.version && !previousQuiz && !previousV3) return {};
    return cleanAnswers(config, saved.answers);
  } catch {
    return {};
  }
}

export function saveAnswers(config: FinderConfig, answers: Answers) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: config.version, answers: cleanAnswers(config, answers) }),
    );
  } catch {
    /* Storage is optional; the quiz still works in private/blocked storage contexts. */
  }
}

export function forgetAnswers() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* No persistent state to clear. */
  }
}

export function message(messages: Messages, key: string, values: Record<string, string | number> = {}) {
  return (messages[key] || '').replace(/\[([a-z_]+)\]/g, (token, name: string) => String(values[name] ?? token));
}

let privacyLoading: Promise<void> | undefined;

export function track(config: FinderConfig, event: string, data: Record<string, string | number> = {}) {
  const shopify = (
    window as Window & {
      Shopify?: {
        customerPrivacy?: { analyticsProcessingAllowed(): boolean };
        analytics?: { publish(name: string, data: unknown): unknown };
        loadFeatures?: (features: { name: string; version: string }[], callback: (error?: unknown) => void) => void;
      };
    }
  ).Shopify;
  // Never buffer denied events or include contact information. Receiving pixels
  // need to subscribe to these custom events before they appear in reports.
  try {
    if (shopify && !shopify.customerPrivacy && shopify.loadFeatures) {
      privacyLoading ||= new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 4000);
        shopify.loadFeatures!([{ name: 'consent-tracking-api', version: '0.2' }], () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      // Wait only for API availability. Never retain events for a later consent change.
      void privacyLoading
        .then(() => {
          if (shopify.customerPrivacy) track(config, event, data);
        })
        .catch(() => {});
      return;
    }
    if (!shopify?.customerPrivacy?.analyticsProcessingAllowed()) return;
    const result = shopify.analytics?.publish(`racket_finder_${event}`, { version: config.version, ...data });
    if (result instanceof Promise) void result.catch(() => {});
  } catch {
    /* Tracking failures must not interrupt the consultation. */
  }
}

export function normaliseProduct(raw: unknown, handle: string): LiveProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as LiveProduct;
  if (value.handle !== handle || typeof value.title !== 'string' || !Array.isArray(value.variants)) return null;
  const variants = value.variants.filter(
    (v) =>
      v &&
      Number.isSafeInteger(v.id) &&
      v.id > 0 &&
      Number.isSafeInteger(v.price) &&
      v.price >= 0 &&
      typeof v.available === 'boolean',
  );
  if (!variants.length) return null;
  return {
    handle,
    title: value.title,
    variants,
    requires_selling_plan: value.requires_selling_plan === true,
    featured_image:
      typeof value.featured_image === 'string' &&
      /^(https:\/\/cdn\.shopify\.com\/|\/\/cdn\.shopify\.com\/)/.test(value.featured_image)
        ? value.featured_image
        : null,
  };
}

export async function loadProducts(
  config: FinderConfig,
  root: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
) {
  const profiles = config.products.filter((p) => p.enabled);
  const products: LiveProduct[] = [];
  const failed: string[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, profiles.length) }, async () => {
      while (index < profiles.length && !signal.aborted) {
        const profile = profiles[index++];
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener('abort', abort, { once: true });
        const timeout = setTimeout(abort, 10000);
        try {
          const response = await request(`${root}products/${encodeURIComponent(profile.handle)}.js`, {
            signal: controller.signal,
            credentials: 'same-origin',
            cache: 'no-store',
          });
          if (!response.ok) throw new Error('Product request failed');
          const product = normaliseProduct(await response.json(), profile.handle);
          if (!product) throw new Error('Invalid product response');
          products.push(product);
        } catch {
          if (!signal.aborted) failed.push(profile.handle);
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener('abort', abort);
        }
      }
    }),
  );
  return { products, failed };
}

// Download the same supplied artwork shown on the results screen. Fetching a
// blob lets the browser save a CDN image instead of navigating away to its URL.
export async function downloadCard(image: string) {
  const response = await fetch(image, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Image request failed');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image response');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const extension = blob.type.slice(6).replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  link.download = `hndrd-court-personality.${extension}`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
