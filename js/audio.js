export function createAudio() {
  const audio = document.createElement('audio');
  audio.src = 'sounds/Neon_Velocity.mp3';
  audio.loop = true;
  audio.volume = 0;
  return audio;
}

export function playBgm(audio) {
  audio.volume = 0;
  audio.play().catch((e) => { console.error('Play fail:', e); });
  fadeInBgm(audio, 2000);
}

export function fadeInBgm(audio, durationMs = 2000) {
  const targetVolume = 0.6;
  const startTime = performance.now();

  const timer = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    audio.volume = progress * targetVolume;

    if (progress >= 1) {
      clearInterval(timer);
    }
  }, 16);
}

export function fadeOutBgm(audio, durationMs = 1000) {
  const startVolume = audio.volume;
  const startTime = performance.now();

  const timer = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    audio.volume = startVolume * (1 - progress);

    if (progress >= 1) {
      clearInterval(timer);
      audio.pause();
    }
  }, 16);
}

export function pauseBgm(audio) {
  fadeOutBgm(audio, 800);
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