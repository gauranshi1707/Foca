// offscreen.js - Synthesizes audio notifications in the offscreen context

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'play-chime') {
    playChime(message.soundType || 'chime');
  }
});

/**
 * Plays a sound based on the chosen type using the Web Audio API.
 */
function playChime(soundType) {
  if (soundType === 'muted' || soundType === 'none') return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    switch (soundType) {

      case 'bowl':
        // Singing Bowl: deep, resonant G3 fundamental + D5 overtone, long decay
        playNote(ctx, 196.00, now,        4.0, 'sine', 0.80);
        playNote(ctx, 587.33, now,        3.5, 'sine', 0.15);
        break;

      case 'soft-bell':
        // Soft Bell: pure C5 with gentle attack and slow decay
        playNote(ctx, 523.25, now,        1.8, 'sine', 0.18);
        playNote(ctx, 1046.5, now,        1.2, 'sine', 0.06);
        break;

      case 'temple-bell':
        // Temple Bell: low fundamental with warm harmonic stack, very long resonance
        playNote(ctx, 110.00, now,        5.0, 'sine', 0.50);
        playNote(ctx, 220.00, now,        4.5, 'sine', 0.20);
        playNote(ctx, 330.00, now,        3.5, 'sine', 0.08);
        playNote(ctx, 440.00, now + 0.1,  2.0, 'sine', 0.04);
        break;

      case 'crystal-bell':
        // Crystal Bell: high-frequency triangle waves, sharp attack, bright decay
        playNote(ctx, 1046.5, now,        1.0, 'triangle', 0.20);
        playNote(ctx, 2093.0, now,        0.8, 'triangle', 0.10);
        playNote(ctx, 3136.0, now + 0.05, 0.6, 'triangle', 0.05);
        break;

      case 'library-chime':
        // Library Chime: warm C5-E5-G5 major arpeggio, unhurried and soft
        playNote(ctx, 523.25, now,        1.6, 'sine', 0.14);
        playNote(ctx, 659.25, now + 0.18, 1.4, 'sine', 0.14);
        playNote(ctx, 783.99, now + 0.36, 1.8, 'sine', 0.14);
        break;

      case 'wind-chime':
        // Wind Chime: delicate high-pitched metallic notes, staggered timing
        playNote(ctx, 1760.0, now,        1.4, 'sine', 0.10);
        playNote(ctx, 1975.5, now + 0.20, 1.2, 'sine', 0.10);
        playNote(ctx, 2637.0, now + 0.40, 1.6, 'sine', 0.08);
        playNote(ctx, 2217.5, now + 0.60, 1.2, 'sine', 0.08);
        playNote(ctx, 1479.0, now + 0.80, 1.0, 'sine', 0.06);
        break;

      case 'wood-knock':
        // Wooden Knock: short triangle burst, heavily damped, warm and percussive
        playNote(ctx, 180.00, now,        0.12, 'triangle', 0.55);
        playNote(ctx, 240.00, now,        0.08, 'triangle', 0.25);
        break;

      case 'digital-ding':
        // Digital Ding: clean B5 sine beep, fast attack, short decay
        playNote(ctx, 987.77, now,        0.30, 'sine', 0.22);
        playNote(ctx, 1318.5, now + 0.05, 0.20, 'sine', 0.10);
        break;

      case 'calm-piano':
        // Calm Piano: C4-E4-G4 major chord with gentle triangle harmonics
        playNote(ctx, 261.63, now,        2.2, 'triangle', 0.22);
        playNote(ctx, 329.63, now + 0.05, 2.0, 'triangle', 0.18);
        playNote(ctx, 392.00, now + 0.10, 1.8, 'triangle', 0.14);
        playNote(ctx, 523.25, now + 0.15, 1.6, 'triangle', 0.08);
        break;

      default:
        // Digital Chime (fallback): E5 -> A5 harmonic rise
        playNote(ctx, 659.25, now,        0.5, 'sine', 0.12);
        playNote(ctx, 880.00, now + 0.25, 1.0, 'sine', 0.12);
        break;
    }
  } catch (error) {
    console.error('Foca Audio: Error playing synthesized sound', error);
  }
}

/**
 * Synthesizes a single bell-like note with a volume envelope.
 */
function playNote(ctx, freq, startTime, duration, type = 'sine', maxVolume = 0.12) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Route: Oscillator -> Gain Node -> Audio output
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Set note type
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  // Volume envelope (Attack / Decay)
  gainNode.gain.setValueAtTime(0, startTime);
  // Fast fade-in (0.05 seconds) to avoid speaker clicks
  gainNode.gain.linearRampToValueAtTime(maxVolume, startTime + 0.05);
  // Exponential fade-out to zero
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // Start and stop oscillator at the specified times
  osc.start(startTime);
  osc.stop(startTime + duration);
}
