import { useCallback, useSyncExternalStore, useEffect } from "react";
import { audioManager, type AudioSettings, type SoundName } from "~/audio/AudioManager";

function subscribe(cb: () => void) {
  return audioManager.subscribe(cb);
}

function getSnapshot(): AudioSettings {
  return audioManager.getSettings();
}

export function useAudio() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const handleInteraction = () => {
      audioManager.unlock();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  const play = useCallback((name: SoundName) => {
    audioManager.play(name);
  }, []);

  const setVolume = useCallback((v: number) => {
    audioManager.setVolume(v);
  }, []);

  const toggleMute = useCallback(() => {
    audioManager.toggleMute();
  }, []);

  return {
    settings,
    play,
    setVolume,
    toggleMute,
  };
}
