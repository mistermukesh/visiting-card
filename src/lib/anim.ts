import gsap from "gsap";

/** Fade + slide items in with stagger. Pass a CSS selector or NodeList. */
export function staggerIn(
  targets: string | Element | Element[] | NodeListOf<Element>,
  delay = 0
) {
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 14 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      ease: "power3.out",
      stagger: 0.06,
      delay,
      clearProps: "transform,opacity",
    }
  );
}

/** Single fade-up on mount. */
export function fadeUp(
  target: Element | null,
  opts: { delay?: number; duration?: number; y?: number } = {}
) {
  if (!target) return;
  gsap.fromTo(
    target,
    { autoAlpha: 0, y: opts.y ?? 14 },
    {
      autoAlpha: 1,
      y: 0,
      duration: opts.duration ?? 0.45,
      ease: "power3.out",
      delay: opts.delay ?? 0,
      clearProps: "transform,opacity",
    }
  );
}

/** Reveal from height-0 (error/success banners). */
export function revealDown(target: Element | null) {
  if (!target) return;
  gsap.fromTo(
    target,
    { autoAlpha: 0, height: 0, marginTop: 0 },
    {
      autoAlpha: 1,
      height: "auto",
      marginTop: "0.5rem",
      duration: 0.3,
      ease: "power2.out",
    }
  );
}

export function collapseUp(target: Element | null, onComplete?: () => void) {
  if (!target) return;
  gsap.to(target, {
    autoAlpha: 0,
    height: 0,
    marginTop: 0,
    duration: 0.22,
    ease: "power2.in",
    onComplete,
  });
}
