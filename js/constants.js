const THREE = window.THREE;

export const GRAVITY    = 0.003;
export const FLAP       = -0.13;
export const PIPE_GAP      = 6.5;
export const PIPE_SPEED    = 0.5;
export const PIPE_SPACING  = 6;
export const SPAWN_MS      = Math.round(PIPE_SPACING / (PIPE_SPEED * 60) * 1000);
export const PIPE_Y_PATTERN = [0, 2.0, -2.0, 1.0, -1.0];
export const EXPLOSION_COLORS = [0x00ffff, 0xff00aa, 0xffffff, 0xff6600, 0xffff00];
