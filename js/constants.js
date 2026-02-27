// ─── SOURCE OF TRUTH ───
export const CONFIG = {
  PHYSICS: {
    GRAVITY: 0.019,
    FLAP: -0.25,
    TERMINAL_VELOCITY: 0.5
  },
  BIRD: {
    BODY_HEIGHT: 0.22,  // bird body Y dimension; collision margin = this / 2
  },
  PIPES: {
    GAP: 7.5,
    SPEED: 0.16,
    SPACING: 4.5,
    SPAWN_Z: -31.0,   // Aligned with prefill: 5.0 - 8 * 4.5 = -31.0
    REMOVE_Z: 15.0,
    HIT_Z_MIN: -2.0,  // collision zone start (pipe approaching bird)
    HIT_Z_MAX: 1.5,   // collision zone end (pipe past bird)
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
  },
  PHASE: {
    MAX_DURATION: 1.5,    // seconds max continuous phase
    COOLDOWN: 1.0,        // seconds locked after depletion
    DRAIN_RATE: 1.0,      // stamina/sec while phasing
    CHARGE_RATE: 0.5,     // stamina/sec while not phasing (3s full recharge)
  },
  LASER: {
    WARMUP_PIPES: 5,          // first N pipes have no laser
    SPAWN_CHANCE: 0.35,       // base probability per pipe
    MAX_CHANCE: 0.7,          // cap at 70%
    CHANCE_PER_SCORE: 0.015,  // +1.5% per point scored
    GAP_FRACTION: 0.25,       // laser height = GAP * 0.25 (25% of gap)
    HIT_Z_MIN: -0.05,         // laser collision zone start
    HIT_Z_MAX: 0.05,          // laser collision zone end
    WIDTH: 2.0,               // mesh width (matches pipe diameter)
    DEPTH: 0.1,               // mesh Z-depth (3D thickness)
    SCANLINE_FREQ: 8.0,       // number of color bands across height
    SCANLINE_SPEED: 5.0,      // scanline scroll speed
    PULSE_SPEED: 3.0,         // overall brightness pulse speed
    COLOR1: 0xff2200,         // primary laser color (red-orange)
    COLOR2: 0xffcc00,         // secondary laser color (yellow)
  },
  ENVIRONMENT: {
    PARALLAX_SPEED: 0.025,
    CITY: {
      WRAP_Z: 15.0,
      WRAP_DISTANCE: 30.0, // Reduced from 60 to fix empty gaps
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
