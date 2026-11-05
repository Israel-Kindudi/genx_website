import { cancelScrollToTop } from "@/lib/scrollToTop";

let activeCancel: (() => void) | null = null;

// Smooth scroll to an element id; returns false when the element is not on the page.
export function scrollToSection(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;

  activeCancel?.();
  cancelScrollToTop();

  const startY = window.scrollY;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const targetY = Math.max(0, Math.min(maxY, target.getBoundingClientRect().top + startY));
  const distance = targetY - startY;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(distance) < 2) {
    window.scrollTo(0, targetY);
    return true;
  }

  const duration = Math.min(1300, Math.max(700, 600 + Math.abs(distance) / 3));
  const startTime = performance.now();
  let frame = 0;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("wheel", cleanup);
    window.removeEventListener("touchstart", cleanup);
    window.removeEventListener("keydown", cleanup);
    if (activeCancel === cleanup) activeCancel = null;
  };
  activeCancel = cleanup;

  window.addEventListener("wheel", cleanup, { passive: true });
  window.addEventListener("touchstart", cleanup, { passive: true });
  window.addEventListener("keydown", cleanup);

  const animate = (now: number) => {
    if (finished) return;
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      frame = requestAnimationFrame(animate);
    } else {
      cleanup();
      window.scrollTo(0, targetY);
    }
  };

  frame = requestAnimationFrame(animate);
  return true;
}
