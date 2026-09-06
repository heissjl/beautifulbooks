'use client';

/**
 * FLIP transition for the loading scene (SPEC 8.1): covers staged large fly
 * to their gallery tiles. Clones animate in a fixed layer while the real
 * tiles stay hidden, then the clones are removed. Respects reduced motion.
 */
export interface StagedRect {
  id: string;
  url: string;
  rect: DOMRect;
}

/** Measures staged tiles before they unmount. */
export function measureStage(root: ParentNode = document): StagedRect[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-stage-cover-id]')).map(el => ({
    id: el.dataset.stageCoverId!,
    url: el.querySelector('img')?.currentSrc ?? el.querySelector('img')?.src ?? '',
    rect: el.getBoundingClientRect(),
  }));
}

export function flyCovers(staged: StagedRect[], durationMs = 650): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (const s of staged) {
    const target = document.querySelector<HTMLElement>(`[data-cover-id="${CSS.escape(s.id)}"]`);
    if (!target || !s.url) continue;
    const to = target.getBoundingClientRect();
    if (to.width === 0) continue;

    const clone = document.createElement('img');
    clone.src = s.url;
    clone.alt = '';
    clone.style.cssText = `position:fixed;left:${s.rect.left}px;top:${s.rect.top}px;width:${s.rect.width}px;height:${s.rect.height}px;object-fit:cover;border-radius:6px;z-index:60;pointer-events:none;box-shadow:0 12px 28px -14px rgba(0,0,0,.45);will-change:transform`;
    document.body.appendChild(clone);

    const dx = to.left - s.rect.left;
    const dy = to.top - s.rect.top;
    const sx = to.width / s.rect.width;
    const sy = to.height / s.rect.height;

    target.style.visibility = 'hidden';
    target.style.animation = 'none';
    const anim = clone.animate(
      [
        { transform: 'translate(0,0) scale(1,1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: 1 },
      ],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
    );
    const finish = () => {
      target.style.visibility = '';
      clone.remove();
    };
    anim.addEventListener('finish', finish);
    anim.addEventListener('cancel', finish);
  }
}
