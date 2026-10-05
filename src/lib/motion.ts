import type { Transition, Variants } from 'motion/react';

// Curvas y variantes compartidas: movimiento corto, suave y sin rebotes exagerados.
export const easeOut: Transition['ease'] = [0.16, 1, 0.3, 1];
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
};

export const stagger = (staggerChildren = 0.05, delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};
