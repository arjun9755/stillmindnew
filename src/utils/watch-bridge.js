// src/utils/watch-bridge.js
// Handles Watch ↔ iPhone communication for StillMind Watch

import { Platform, TurboModuleRegistry } from "react-native";
import { saveSession } from "./storage";

let watchEvents = null;
let watchAPI = null;
let isSetup = false;

/**
 * Initialize Watch connectivity listener.
 * Call once from _layout.jsx on app start.
 */
export async function initWatchBridge() {
  if (Platform.OS !== "ios" || isSetup) return;

  // Guard: TurboModuleRegistry.get is non-enforcing (returns null instead of throwing).
  // react-native-watch-connectivity uses getEnforcing internally, which would crash
  // the JS thread in development mode if WatchConnectivity isn't linked.
  // Pre-checking with get() prevents loading the module when it isn't available.
  try {
    if (!TurboModuleRegistry.get("WatchConnectivity")) {
      return;
    }
  } catch (_) {
    return;
  }

  try {
    const mod = require("react-native-watch-connectivity");
    // watchEvents is a named export in react-native-watch-connectivity v2.x
    watchEvents = mod.watchEvents;
    watchAPI = mod;
    isSetup = true;

    watchEvents.on("message", handleWatchMessage);
    watchEvents.on("user-info", handleWatchMessage);
    // Note: activateWatchConnectivity does not exist in v2.x – the session
    // is managed automatically by the native layer.
    console.log("[WatchBridge] initialized");
  } catch (e) {
    console.log("[WatchBridge] not available:", e && e.message);
    isSetup = false;
    watchEvents = null;
    watchAPI = null;
  }
}

/**
 * Handle incoming message from Apple Watch
 */
async function handleWatchMessage(message) {
  if (!message || !message.type) return;

  switch (message.type) {
    case "breathing_session":
      await handleBreathingSession(message);
      break;
    case "stress_event":
      await handleStressEvent(message);
      break;
    default:
      console.log("[WatchBridge] unknown message type:", message.type);
  }
}

/**
 * Save Watch breathing session to StillMind statistics
 */
async function handleBreathingSession(data) {
  try {
    const session = {
      id: `watch_${Date.now()}`,
      timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
      durationSeconds: data.duration || 60,
      durationMinutes: Math.round((data.duration || 60) / 60),
      mode: data.mode || "box",
      source: "watch",
      completed: data.completed !== false,
      cycles: data.cycles || 0,
      moodBefore: null,
      moodAfter: null,
      note: null,
    };

    await saveSession(session);
    console.log("[WatchBridge] session saved:", session.id);
  } catch (e) {
    console.error("[WatchBridge] failed to save session:", e);
  }
}

/**
 * Save stress event to storage for Statistics chart
 */
async function handleStressEvent(data) {
  try {
    const storageMod = require("@react-native-async-storage/async-storage");
    const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
    const key = "stillmind:stress_events";
    const existing = await AsyncStorage.getItem(key);
    const events = existing ? JSON.parse(existing) : [];

    events.push({
      timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
      hrv: data.hrv,
      heartRate: data.heartRate,
      source: "watch",
    });

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const trimmed = events
      .filter((e) => e.timestamp > cutoff)
      .slice(-500);

    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    console.log("[WatchBridge] stress event saved");
  } catch (e) {
    console.error("[WatchBridge] failed to save stress event:", e);
  }
}

/**
 * Send data to Watch (e.g. daily streak, latest session)
 */
export async function sendToWatch(data) {
  if (!watchAPI || Platform.OS !== "ios") return;
  try {
    await watchAPI.updateApplicationContext(data);
  } catch (e) {
    console.log("[WatchBridge] sendToWatch failed:", e && e.message);
  }
}

/**
 * Get stored stress events for Statistics chart
 */
export async function getStressEvents() {
  try {
    const storageMod = require("@react-native-async-storage/async-storage");
    const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
    const raw = await AsyncStorage.getItem("stillmind:stress_events");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Check if Watch is currently reachable
 */
export async function isWatchReachable() {
  if (!watchAPI || Platform.OS !== "ios") return false;
  try {
    const state = await watchAPI.getSessionState();
    return state && state.isReachable === true;
  } catch {
    return false;
  }
}
