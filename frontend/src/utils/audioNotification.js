/**
 * Professional Web Audio Synthesizer Chime for Admin Notifications
 * Uses dual-tone harmonic chime (E5 -> B5) with soft envelope
 */
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Unlock audio context if needed
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (frequency, delay, duration, gainValue = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    };

    // Professional two-tone notification chime: E5 (659.25Hz) followed by B5 (987.77Hz)
    playTone(659.25, 0, 0.45, 0.2);
    playTone(987.77, 0.12, 0.6, 0.3);
  } catch (err) {
    console.warn('Audio notification warning:', err.message);
  }
}
