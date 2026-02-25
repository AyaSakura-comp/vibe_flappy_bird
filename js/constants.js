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
      STRENGTH: 0.8,
      RADIUS: 0.4,
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
  },
  ENVIRONMENT: {
    PARALLAX_SPEED: 0.025,
    CITY: {
      WRAP_Z: 15.0,
      WRAP_DISTANCE: 40.0, // Reduced from 60 to fix empty gaps
      BUILDINGS: [
        { x: -18, w: 2.0, d: 2.0, h: 10, z:  -8 },
        { x: -19, w: 1.8, d: 1.8, h: 14, z: -12 },
        { x: -22, w: 2.0, d: 2.0, h:  9, z:  -9 },
        { x: -23, w: 1.5, d: 1.5, h: 18, z: -13 },
        { x: -24, w: 1.8, d: 1.8, h: 12, z: -17 },
        { x: -27, w: 2.0, d: 2.0, h:  8, z: -14 },
        { x: -28, w: 1.5, d: 1.5, h: 20, z: -18 },
        { x: -30, w: 1.8, d: 1.8, h: 15, z: -20 },
      ],
      DISTANT_BUILDINGS: [
        { x: -32, w: 2.5, d: 2.0, h: 22, z: -22 },
        { x: -33, w: 2.0, d: 1.8, h: 16, z: -26 },
        { x: -36, w: 2.0, d: 1.8, h: 14, z: -23 },
        { x: -37, w: 2.5, d: 2.0, h: 24, z: -27 },
        { x: -38, w: 2.0, d: 1.8, h: 18, z: -24 },
        { x: -34, w: 2.0, d: 1.8, h: 20, z: -28 },
      ]
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
