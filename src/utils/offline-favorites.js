/**
 * offline-favorites.js — StillMind
 * Caches session audio files locally using expo-file-system.
 * Stores favorite session IDs in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

let FileSystem = null;
try {
  FileSystem = require("expo-file-system");
} catch (_) {}

const FAVORITES_KEY = "offline_favorites_v1";
const CACHE_DIR = FileSystem
  ? `${FileSystem.documentDirectory}stillmind_audio_cache/`
  : null;

// ── Favorites storage ────────────────────────────────────────────────────────

export const getOfflineFavorites = async () => {
  try {
    const v = await AsyncStorage.getItem(FAVORITES_KEY);
    return v ? JSON.parse(v) : [];
  } catch (_) {
    return [];
  }
};

export const addOfflineFavorite = async (sessionId) => {
  try {
    const favs = await getOfflineFavorites();
    if (!favs.includes(sessionId)) {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs, sessionId]));
    }
  } catch (_) {}
};

export const removeOfflineFavorite = async (sessionId) => {
  try {
    const favs = await getOfflineFavorites();
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.filter(id => id !== sessionId)));
    // Also delete cached file
    await deleteCachedAudio(sessionId);
  } catch (_) {}
};

export const isOfflineFavorite = async (sessionId) => {
  try {
    const favs = await getOfflineFavorites();
    return favs.includes(sessionId);
  } catch (_) {
    return false;
  }
};

// ── Audio caching ────────────────────────────────────────────────────────────

const ensureCacheDir = async () => {
  if (!FileSystem || !CACHE_DIR) return false;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    return true;
  } catch (_) {
    return false;
  }
};

const cachePathFor = (sessionId, audioUrl) => {
  if (!CACHE_DIR) return null;
  const ext = audioUrl.split("?")[0].split(".").pop() || "mp3";
  return `${CACHE_DIR}${sessionId}.${ext}`;
};

/**
 * Get the local cached path for a session if it exists.
 * Returns null if not cached or FileSystem unavailable.
 */
export const getCachedAudioPath = async (sessionId) => {
  if (!FileSystem || !CACHE_DIR) return null;
  try {
    // Try both mp3 and wav extensions
    for (const ext of ["mp3", "wav", "m4a"]) {
      const localPath = `${CACHE_DIR}${sessionId}.${ext}`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) return localPath;
    }
  } catch (_) {}
  return null;
};

/**
 * Download and cache audio for a session.
 * @param {string} sessionId
 * @param {string} audioUrl — CDN URL
 * @param {function} onProgress — optional (progress: 0–1) => void
 * @returns {{ success: boolean, localUri?: string }}
 */
export const cacheAudioForSession = async (sessionId, audioUrl, onProgress) => {
  if (!FileSystem || !CACHE_DIR) return { success: false };
  try {
    const ready = await ensureCacheDir();
    if (!ready) return { success: false };

    const localPath = cachePathFor(sessionId, audioUrl);
    if (!localPath) return { success: false };

    // Already cached?
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size > 0) {
      return { success: true, localUri: localPath };
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      localPath,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (onProgress && totalBytesExpectedToWrite > 0) {
          onProgress(totalBytesWritten / totalBytesExpectedToWrite);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result && result.uri) {
      return { success: true, localUri: result.uri };
    }
    return { success: false };
  } catch (_) {
    return { success: false };
  }
};

/**
 * Get local URI if cached, otherwise null.
 */
export const getCachedAudioUri = async (sessionId, audioUrl) => {
  if (!FileSystem || !CACHE_DIR || !audioUrl) return null;
  try {
    const localPath = cachePathFor(sessionId, audioUrl);
    if (!localPath) return null;
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists && info.size > 0 ? localPath : null;
  } catch (_) {
    return null;
  }
};

/**
 * Delete cached audio for a session.
 */
export const deleteCachedAudio = async (sessionId) => {
  if (!FileSystem || !CACHE_DIR) return;
  try {
    // Try both mp3 and m4a
    for (const ext of ["mp3", "wav", "m4a"]) {
      const p = `${CACHE_DIR}${sessionId}.${ext}`;
      const info = await FileSystem.getInfoAsync(p);
      if (info.exists) await FileSystem.deleteAsync(p, { idempotent: true });
    }
  } catch (_) {}
};

/**
 * Get total cache size in MB.
 */
export const getCacheSizeMB = async () => {
  if (!FileSystem || !CACHE_DIR) return 0;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR, { size: true });
    if (!info.exists) return 0;
    return ((info.size || 0) / (1024 * 1024));
  } catch (_) {
    return 0;
  }
};

/**
 * Clear all cached audio.
 */
export const clearAudioCache = async () => {
  if (!FileSystem || !CACHE_DIR) return;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
    await AsyncStorage.removeItem(FAVORITES_KEY);
  } catch (_) {}
};
