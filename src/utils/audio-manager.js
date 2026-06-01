import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * 🎵 Audio Manager für StillMind
 * Production-ready audio system with external CDN
 */

// -----------------------------
// ✅ NEW DEFAULT CDN (Cloudflare R2)
// -----------------------------
const DEFAULT_AUDIO_CDN_BASE =
  "https://pub-10d1ab3245524dc29b0ce6ddd31a187a.r2.dev";

// If set, this base overrides ALL audio URLs
// Example: EXPO_PUBLIC_AUDIO_CDN_BASE=https://cdn.example.com/stillmind/audio
// If NOT set, we use DEFAULT_AUDIO_CDN_BASE (R2)
const AUDIO_CDN_BASE = String(
  process.env.EXPO_PUBLIC_AUDIO_CDN_BASE || DEFAULT_AUDIO_CDN_BASE
)
  .trim()
  .replace(/\/+$/, "");

// -----------------------------
// File mapping (these filenames must exist on the CDN)
// -----------------------------
const AUDIO_FILES = {
  calm: "calm.mp3",
  sleep: "sleep.mp3",
  focus: "focus.mp3",
  emotion: "emotion.mp3",
  parent: "parents.mp3",
  work: "office.mp3",
  thoughts: "stop.mp3",
};

const AUDIO_URLS = Object.fromEntries(
  Object.entries(AUDIO_FILES).map(([k, f]) => [k, `${AUDIO_CDN_BASE}/${f}`])
);

// -----------------------------
// Session SFX mapping
// IMPORTANT: Keep these names unless you also rename files in R2.
// -----------------------------
const SESSION_SFX = {
  start: `${AUDIO_CDN_BASE}/Start.wav`,
  end: `${AUDIO_CDN_BASE}/End.mp3`,
};

export function useBackgroundMusic(
  categoryId,
  isPlaying = false,
  volume = 0.3,
  sessionId = null  // pass session ID to check local cache
) {
  const cdnUrl = AUDIO_URLS[categoryId];
  // Start with null → resolve async → prevents stale CDN player when local cache exists
  const [resolvedUrl, setResolvedUrl] = React.useState(null);
  const [urlResolved, setUrlResolved] = React.useState(false);

  // Check local cache on mount/sessionId change
  React.useEffect(() => {
    let alive = true;
    setUrlResolved(false);
    setResolvedUrl(null);
    (async () => {
      try {
        if (sessionId) {
          const { getCachedAudioPath } = require("@/utils/offline-favorites");
          const local = await getCachedAudioPath(sessionId);
          if (alive) {
            setResolvedUrl(local || cdnUrl);
            setUrlResolved(true);
          }
        } else {
          if (alive) {
            setResolvedUrl(cdnUrl);
            setUrlResolved(true);
          }
        }
      } catch (_) {
        if (alive) {
          setResolvedUrl(cdnUrl);
          setUrlResolved(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [sessionId, cdnUrl]);

  // Only create player once URL is resolved to avoid double-loading
  const player = useAudioPlayer(urlResolved ? resolvedUrl : null);
  const fadeIntervalRef = useRef(null);
  const targetVolumeRef = useRef(volume);

  useEffect(() => {
    targetVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    if (!resolvedUrl) return;

    // Audio-Player konfigurieren
    if (player.isLoaded) {
      player.loop = true;
      player.volume = 0; // Starten mit 0 für Fade-In
    }
  }, [player.isLoaded, categoryId, resolvedUrl]);

  useEffect(() => {
    if (!player.isLoaded) return;

    // Cleanup vorheriges Fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (isPlaying) {
      // 🎶 Fade-In starten
      player.volume = 0;
      player.play();

      let currentVolume = 0;
      const fadeIn = setInterval(() => {
        currentVolume += 0.04;
        if (currentVolume >= targetVolumeRef.current) {
          player.volume = targetVolumeRef.current;
          clearInterval(fadeIn);
        } else {
          player.volume = currentVolume;
        }
      }, 80);

      fadeIntervalRef.current = fadeIn;

      return () => {
        if (fadeIn) clearInterval(fadeIn);
      };
    } else {
      // 🔇 Fade-Out starten
      if (player.playing) {
        let currentVolume = player.volume;
        const fadeOut = setInterval(() => {
          currentVolume -= 0.04;
          if (currentVolume <= 0) {
            player.volume = 0;
            player.pause();
            clearInterval(fadeOut);
          } else {
            player.volume = currentVolume;
          }
        }, 80);

        fadeIntervalRef.current = fadeOut;

        return () => {
          if (fadeOut) clearInterval(fadeOut);
        };
      }
    }
  }, [isPlaying, player.isLoaded]);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      try {
        if (player.playing) {
          player.pause();
        }
        player.remove();
      } catch (error) {
        // Silent error in production
      }
    };
  }, []);

  return {
    isLoading: !urlResolved || !player.isLoaded,
    error: null,
    player,
    resolvedUrl,
  };
}

export function getAudioUrl(categoryId) {
  return AUDIO_URLS[categoryId] || null;
}

export function getSessionSfxUrl(kind) {
  return SESSION_SFX[kind] || null;
}

export function getAvailableCategories() {
  return Object.keys(AUDIO_URLS);
}

export async function preloadAudio(categoryId) {
  const url = AUDIO_URLS[categoryId];
  if (!url) return false;

  try {
    if (Platform.OS === "web") {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.load();
    }
    return true;
  } catch (error) {
    // Silent error in production
    return false;
  }
}

export async function preloadAllAudio() {
  const categories = Object.keys(AUDIO_URLS);
  const promises = categories.map((cat) => preloadAudio(cat));
  await Promise.allSettled(promises);
}