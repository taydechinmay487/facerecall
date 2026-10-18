import { useCallback, useEffect, useState } from "react";

interface SpeakOptions {
  rate?: number;
  voiceName?: string | null;
}

export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!supported || !text.trim()) return false;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1));
        const match = options.voiceName
          ? voices.find((voice) => voice.name === options.voiceName)
          : undefined;
        if (match) utterance.voice = match;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [supported, voices],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, voices, speak, cancel };
}
