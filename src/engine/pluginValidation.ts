import type { MiniGamePlugin } from "./types";

export const PLUGIN_LIMITS = {
  goldPerCompletion: { min: 0, max: 500 },
  /** Regular variants: 10 seconds → 72 hours */
  duration: { min: 10, max: 259_200 },
  /** Hard-mode variants: 1 hour → 30 days */
  hardModeDuration: { min: 3_600, max: 2_592_000 },
  /** "How" upgrade speed ceiling across all games */
  conditionMultiplierMax: 500,
  /** Per-tick gold ceiling enforced by shells regardless of engine output */
  goldPerTickMax: 50,
} as const;

type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validatePlugin(plugin: MiniGamePlugin): ValidationResult {
  const errors: string[] = [];
  const id = plugin.id;

  if (!plugin.variants || plugin.variants.length === 0) {
    return { ok: true }; // no variant declarations → skip variant checks
  }

  for (const v of plugin.variants) {
    const { min: gMin, max: gMax } = PLUGIN_LIMITS.goldPerCompletion;
    if (v.goldPerCompletion < gMin || v.goldPerCompletion > gMax) {
      errors.push(
        `[${id}] variant "${v.id}": goldPerCompletion ${v.goldPerCompletion} outside [${gMin}, ${gMax}]`
      );
    }

    if (v.isHardMode) {
      const { min, max } = PLUGIN_LIMITS.hardModeDuration;
      if (v.baseDurationSeconds < min || v.baseDurationSeconds > max) {
        errors.push(
          `[${id}] hard-mode variant "${v.id}": baseDurationSeconds ${v.baseDurationSeconds} outside [${min}, ${max}]`
        );
      }
    } else {
      const { min, max } = PLUGIN_LIMITS.duration;
      if (v.baseDurationSeconds < min || v.baseDurationSeconds > max) {
        errors.push(
          `[${id}] variant "${v.id}": baseDurationSeconds ${v.baseDurationSeconds} outside [${min}, ${max}]`
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

/** Called at registration time. Throws in dev, warns in prod. */
export function assertPlugin(plugin: MiniGamePlugin): void {
  const result = validatePlugin(plugin);
  if (result.ok) return;

  const message = `Plugin validation failed:\n${result.errors.join("\n")}`;
  if (import.meta.env.DEV) {
    throw new Error(message);
  } else {
    console.warn(message);
  }
}
