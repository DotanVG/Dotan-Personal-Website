import type { Transition } from "framer-motion";

// One vocabulary for every spring in the app: stiffness / damping / mass.
// Damping ratio = damping / 2√(stiffness·mass).

// Ratio ≈ 1.03 — settles without overshoot. UI chrome.
export const SPRING_UI: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 40,
  mass: 1,
};

// Ratio ≈ 0.81 — a touch of overshoot. Pointer/gesture-driven motion.
// Bare SpringOptions because useSpring takes the physics without a `type`.
export const SPRING_GESTURE = { stiffness: 300, damping: 28, mass: 1 };

// Framer's JS-driven springs ignore the global prefers-reduced-motion CSS override,
// so reduced-motion callers must swap this in explicitly.
export const INSTANT: Transition = { duration: 0 };
