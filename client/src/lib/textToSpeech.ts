/**
 * Text-to-speech utility function using the Web Speech API
 */

export function speakText(text: string): void {
  // Check if the browser supports speech synthesis
  if ('speechSynthesis' in window) {
    // Create a new speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Set properties for the speech
    utterance.lang = 'en-US'; // Language
    utterance.rate = 1.0;      // Speed (0.1 to 10)
    utterance.pitch = 1.0;     // Pitch (0 to 2)
    utterance.volume = 1.0;    // Volume (0 to 1)
    
    // Speak the text
    window.speechSynthesis.speak(utterance);
  } else {
    console.error('Speech synthesis is not supported in this browser.');
    // Could show a toast notification here
  }
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}