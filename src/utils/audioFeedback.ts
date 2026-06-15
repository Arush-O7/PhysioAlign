let sharedAudioContext: AudioContext | null = null;

/**
 * Play synthesizer beeps completely client-side in the browser
 */
export const playAudioCue = async (cueType: 'success' | 'warning' | 'error' | 'info') => {
  try {
    if (typeof window === 'undefined') return;

    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (sharedAudioContext.state === 'suspended') {
      await sharedAudioContext.resume();
    }

    const oscillator = sharedAudioContext.createOscillator();
    const gainNode = sharedAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(sharedAudioContext.destination);

    const audioParams = {
      success: { frequency: 720, duration: 0.15 },
      warning: { frequency: 540, duration: 0.25 },
      error: { frequency: 380, duration: 0.35 },
      info: { frequency: 650, duration: 0.2 },
    };

    const params = audioParams[cueType];

    oscillator.frequency.value = params.frequency;
    gainNode.gain.setValueAtTime(0.2, sharedAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.005,
      sharedAudioContext.currentTime + params.duration
    );

    oscillator.start(sharedAudioContext.currentTime);
    oscillator.stop(sharedAudioContext.currentTime + params.duration);
  } catch (error) {
    console.error('[PhysioAlign Audio] Synthesizer error:', error);
  }
};

/**
 * Text-to-speech audio cues using the standard Web Speech API
 */
export const speakFeedback = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  // Cancel any currently speaking utterances to avoid queuing delay
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.15;
  utterance.pitch = 1.0;
  utterance.volume = 0.75;
  
  window.speechSynthesis.speak(utterance);
};
