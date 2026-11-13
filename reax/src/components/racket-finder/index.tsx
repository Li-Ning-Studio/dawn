import { render } from 'preact';
import { validateConfig } from './engine.ts';
import { flow } from './config.ts';
import { Finder } from './Finder.tsx';
import { readSaved, track } from './platform.ts';
import type { FinderConfig, Messages } from './config.ts';

// Only catalogue profiles and presentation settings cross the Liquid boundary.
// Quiz definitions and locale keys are compiled once and shared with tests.
export function resolveMetaobjects(value: unknown, messages: Messages) {
  if (!value || typeof value !== 'object') throw new Error('Finder settings are missing');
  const payload = value as {
    products: FinderConfig['products'];
    resultLimit: number;
    complete: boolean;
    archetypeImages?: Record<string, unknown>;
  };
  if (payload.complete !== true) throw new Error('Finder profile collection is incomplete');
  const config: FinderConfig = structuredClone({
    ...flow,
    products: payload.products,
    resultLimit: payload.resultLimit,
  });
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join('; '));
  // Artwork belongs to the section settings. Blank or non-HTTPS URLs hide only
  // that card's artwork/download; they never change identity or racket matching.
  for (const archetype of config.archetypes) {
    const image = payload.archetypeImages?.[archetype.id];
    if (typeof image === 'string' && /^https:\/\//i.test(image.trim())) archetype.image = image.trim();
  }
  for (const p of config.products) {
    if (!p.shaftFlex) delete p.shaftFlex;
    if (!p.balance) delete p.balance;
  }
  return { config, messages };
}

const mounted = new Map<HTMLElement, () => void>();

export function readMessages(dataset: DOMStringMap): Messages {
  // data-message-style-attack becomes messageStyleAttack in the DOM. Convert
  // back to the locale key, including numeric suffixes such as budget-2000.
  // Attribute entities are already decoded by the browser.
  return Object.fromEntries(
    Object.entries(dataset)
      .filter(([key]) => /^message[A-Z]/.test(key))
      .map(([key, value]) => [
        key
          .slice(7)
          .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          .replace(/-/g, '_')
          .slice(1),
        value || '',
      ]),
  );
}

function mount(section: HTMLElement) {
  if (mounted.has(section)) return;
  const target = section.querySelector<HTMLElement>('[data-finder-app]');
  const intro = section.querySelector<HTMLElement>('[data-finder-intro]');
  const button = section.querySelector<HTMLButtonElement>('[data-finder-start]');
  const error = section.querySelector<HTMLElement>('[data-finder-error]');
  const video = section.querySelector<HTMLVideoElement>('[data-finder-hero-video]');
  if (!target || !intro || !button) return;
  try {
    const translations = readMessages(section.dataset);
    const { config, messages } = resolveMetaobjects(
      JSON.parse(section.querySelector('[data-finder-config]')?.textContent || 'null'),
      translations,
    );
    let active = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Start, home and motion changes own video playback; no DOM observer or
    // cross-bundle events are needed now that this entry owns the whole section.
    const syncVideo = () => {
      if (intro.hidden || motion.matches) video?.pause();
      else video?.play().catch(() => {});
    };
    const start = () => {
      if (active) return;
      active = true;
      // Read device answers again so restarting cannot resurrect cleared state.
      const saved = readSaved(config);
      intro.hidden = true;
      target.hidden = false;
      syncVideo();
      render(
        <Finder
          config={config}
          messages={messages}
          root={section.dataset.root || '/'}
          browseUrl={section.dataset.browseUrl || ''}
          currency={section.dataset.currency || ''}
          saved={saved}
          section={section}
          onHome={home}
        />,
        target,
      );
      if (!Object.keys(saved).length) track(config, 'started');
    };
    const home = () => {
      active = false;
      render(null, target);
      target.hidden = true;
      intro.hidden = false;
      syncVideo();
      button.focus();
    };
    button.addEventListener('click', start);
    button.disabled = false;
    if (error) error.hidden = true;
    motion.addEventListener('change', syncVideo);
    mounted.set(section, () => {
      render(null, target);
      button.removeEventListener('click', start);
      button.disabled = true;
      motion.removeEventListener('change', syncVideo);
      video?.pause();
    });
    if (Object.keys(readSaved(config)).length) start();
    else syncVideo();
  } catch {
    button.disabled = true;
    if (error) error.hidden = false;
  }
}

document.querySelectorAll<HTMLElement>('[data-racket-finder]').forEach(mount);
document.addEventListener('shopify:section:load', (event) => {
  if (event.target instanceof HTMLElement)
    event.target.querySelectorAll<HTMLElement>('[data-racket-finder]').forEach(mount);
});
document.addEventListener('shopify:section:unload', (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  for (const [section, unmount] of mounted) {
    if (event.target.contains(section)) {
      unmount();
      mounted.delete(section);
    }
  }
});
