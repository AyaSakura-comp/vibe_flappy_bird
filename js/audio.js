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