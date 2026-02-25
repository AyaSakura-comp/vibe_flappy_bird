// ─── SOURCE OF TRUTH ───
export const CONFIG = {
  PHYSICS: {
    GRAVITY: 0.019,
    FLAP: -0.25,
    TERMINAL_VELOCITY: 0.5
  },
  PIPES: {
    GAP: 7.5,
    SPEED: 0.16,
    SPACING: 4.5,
    SPAWN_Z: -31.0,   // Aligned with prefill: 5.0 - 8 * 4.5 = -31.0
    REMOVE_Z: 15.0,
    Y_PATTERN: [0, 2.0, -2.0, 1.0, -1.0]
  },
  VISUALS: {
    COLORS: {
      CYAN: 0x00e5ff,
      PINK: 0xff00ff,
      PURPLE: 0xbc13fe,
      ORANGE: 0xff6600,
      BG: 0x1a0044,
      EXPLOSION: [0x00ffff, 0xff00ff, 0xffffff, 0xff6600, 0xffff00]
    },
    BLOOM: {
      STRENGTH: 1.4,
      RADIUS: 1.2,
      THRESHOLD: 0.3
    },
    POST_PROCESSING: {
      COLOR_GRADE: {
        SHADOW_CRUSH: 0.15,
        MAGENTA_PUSH: 0.08,
        CONTRAST: 1.2
      },
      VIGNETTE: {
        OFFSET: 1.0,
        DARKNESS: 1.4
      },
      FILM: {
        N_INTENSITY: 0.25,
        S_INTENSITY: 0.15,
        S_COUNT: 400
      },
      CHROMA: {
        AMOUNT: 0.003
      }
    }
  }
};

// Derived values
export const SPAWN_MS = Math.round(CONFIG.PIPES.SPACING / (CONFIG.PIPES.SPEED * 60) * 1000);

// Backward compatibility exports (optional, but cleaner to update callers)
export const GRAVITY = CONFIG.PHYSICS.GRAVITY;
export const FLAP = CONFIG.PHYSICS.FLAP;
export const PIPE_GAP = CONFIG.PIPES.GAP;
export const PIPE_SPEED = CONFIG.PIPES.SPEED;
export const PIPE_SPACING = CONFIG.PIPES.SPACING;
export const PIPE_SPAWN_Z = CONFIG.PIPES.SPAWN_Z;
export const PIPE_REMOVE_Z = CONFIG.PIPES.REMOVE_Z;
export const PIPE_Y_PATTERN = CONFIG.PIPES.Y_PATTERN;
export const EXPLOSION_COLORS = CONFIG.VISUALS.COLORS.EXPLOSION;
export const BLOOM = CONFIG.VISUALS.BLOOM;
