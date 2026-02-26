export function createAudio() {
  const audio = document.createElement('audio');
  audio.src = 'sounds/Neon_Velocity.mp3';
  audio.loop = true;
  audio.volume = 0.6;
  return audio;
}

export function playBgm(audio) {
  audio.play().catch(() => {});
}

export function pauseBgm(audio) {
  audio.pause();
}

export function createSfx() {
  const make = () => {
    const el = document.createElement('audio');
    el.src = '';
    el.volume = 0.8;
    return el;
  };
  return {
    phaseIn: make(),
    phaseOut: make(),
    laserPass: make(),
    laserDeath: make(),
  };
}

function playSfxSlot(el) {
  // Only play if src is valid and not just the current page URL
  if (el && el.src && el.src !== '' && el.src !== window.location.href) {
    el.currentTime = 0;
    el.play().catch(() => {});
  }
}

export function playPhaseIn(sfx) { playSfxSlot(sfx.phaseIn); }
export function playPhaseOut(sfx) { playSfxSlot(sfx.phaseOut); }
export function playLaserPass(sfx) { playSfxSlot(sfx.laserPass); }
export function playLaserDeath(sfx) { playSfxSlot(sfx.laserDeath); }