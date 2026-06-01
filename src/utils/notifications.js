// notifications.js – Täglich 11:45 und 19:45 Uhr, ab dem gleichen Tag
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getLanguage } from "./i18n";
import {
  getReminderEnabled,
  setReminderEnabled,
  getIntervalReminderScheduledId,
  setIntervalReminderScheduledId,
  setIntervalReminderNextAt,
  getSessionHistory,
  getUserName,
  getDailyStreak,
} from "./storage";

// ── Handler: Notifications auch im Vordergrund anzeigen ──────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = "stillmind-reminders";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "StillMind Erinnerungen",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      description: "Sanfte StillMind-Erinnerungen",
      enableLights: true,
      enableVibrate: true,
      lightColor: "#CDB98A",
    });
  } catch (_) {}
}

export const initializeNotifications = async () => {
  await ensureAndroidChannel();
};

export const requestNotificationPermissions = async () => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (_) {
    return false;
  }
};

export const checkNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch (_) {
    return false;
  }
};

// ── Texte ─────────────────────────────────────────────────────────────────────
// Persönliche, aktive Texte die direkt zum Session-Start führen
// ── Personalisierte Notification-Texte ───────────────────────────────────────
// Werden zur Laufzeit mit Username + Streak befüllt

function buildMittagTexts(name, streak, modeIcon, modeName, lang) {
  const isEN = lang === "en";
  const greeting = name ? `${name}, ` : "";
  const streakSuffix = streak >= 2
    ? (isEN ? ` 🔥 ${streak} days.` : ` 🔥 ${streak} Tage.`)
    : "";
  const cta = isEN
    ? `${modeIcon} Start ${modeName} now.`
    : `${modeIcon} ${modeName} jetzt starten.`;
  const titles = isEN
    ? [
        `${greeting}time for you ☁️`,
        "60 seconds. Right now.",
        `${greeting}quick break?`,
        "Your midday moment",
      ]
    : [
        `${greeting}Zeit für dich ☁️`,
        "60 Sekunden. Jetzt.",
        `${greeting}kurze Pause?`,
        "Dein Mittagsmoment",
      ];
  const bodies = isEN
    ? [
        `${cta}${streakSuffix}`,
        `Land for a moment mid-day. ${cta}${streakSuffix}`,
        `Everything else can wait. ${cta}`,
        `Halfway through. ${cta}${streakSuffix}`,
      ]
    : [
        `${cta}${streakSuffix}`,
        `Mitten im Tag kurz landen. ${cta}${streakSuffix}`,
        `Alles andere kann warten. ${cta}`,
        `Halbzeit. ${cta}${streakSuffix}`,
      ];
  return { title: randomFrom(titles), body: randomFrom(bodies) };
}

function buildAbendTexts(name, streak, modeIcon, modeName, lang) {
  const isEN = lang === "en";
  const greeting = name ? `${name}, ` : "";
  const streakSuffix = streak >= 2
    ? (isEN ? ` 🔥 ${streak} days in a row.` : ` 🔥 ${streak} Tage in Folge.`)
    : "";
  const cta = isEN
    ? `${modeIcon} Start ${modeName}.`
    : `${modeIcon} ${modeName} starten.`;
  const titles = isEN
    ? [
        `${greeting}let go of the day 🌙`,
        "Clock out mentally",
        `${greeting}one last minute for you`,
        "Wind down – now",
      ]
    : [
        `${greeting}den Tag ablegen 🌙`,
        "Feierabend im Kopf",
        `${greeting}letzte Minute für dich`,
        "Runterfahren – jetzt",
      ];
  const bodies = isEN
    ? [
        `The day is almost done. ${cta}${streakSuffix}`,
        `Breathe in. Breathe out. ${cta}${streakSuffix}`,
        `One more session – then you're really done. ${cta}`,
        `Your nervous system is asking. ${cta}${streakSuffix}`,
      ]
    : [
        `Der Tag ist fast durch. ${cta}${streakSuffix}`,
        `Einatmen. Ausatmen. ${cta}${streakSuffix}`,
        `Noch eine Session – dann bist du wirklich fertig. ${cta}`,
        `Dein Nervensystem meldet sich. ${cta}${streakSuffix}`,
      ];
  return { title: randomFrom(titles), body: randomFrom(bodies) };
}

// Lieblingsession aus Usage-Daten – wird als Deep Link mitgegeben
// Falls keine vorhanden: calm-1 als sinnvoller Default
const DEFAULT_SESSION_ID = "calm-1";

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Hilfsfunktion: nächsten Zeitpunkt für HH:MM heute oder morgen ─────────────
function nextOccurrence(hour, minute) {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  // Wenn die Zeit heute schon vorbei ist (+ 60s Puffer), nehmen wir morgen
  if (candidate.getTime() - now.getTime() < 60 * 1000) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

// ── Präferenz → Mode-Mapping ─────────────────────────────────────────────────
// Onboarding speichert Label-Strings (z.B. "Stress reduzieren"), wir mappen
// diese auf eine konkrete Session-ID die als Deep Link genutzt wird.
const PREF_TO_SESSION = {
  // DE
  "Stress reduzieren":    "calm-1",
  "Besser einschlafen":   "sleep-1",
  "Fokussierter arbeiten":"focus-1",
  "Emotional runterfahren":"calm-1",
  // EN
  "Reduce stress":        "calm-1",
  "Sleep better":         "sleep-1",
  "Work more focused":    "focus-1",
  "Calm emotions":        "calm-1",
};

const PREF_TO_MODE = {
  "Stress reduzieren":    "calm",
  "Besser einschlafen":   "sleep",
  "Fokussierter arbeiten":"focus",
  "Emotional runterfahren":"calm",
  "Reduce stress":        "calm",
  "Sleep better":         "sleep",
  "Work more focused":    "focus",
  "Calm emotions":        "calm",
};

const MODE_ICONS = { calm: "🌊", sleep: "🌙", focus: "🎯", emotion: "💚" };
const MODE_NAMES_DE = { calm: "Calm", sleep: "Einschlafen", focus: "Fokus", emotion: "Emotion" };
const MODE_NAMES_EN = { calm: "Calm", sleep: "Sleep", focus: "Focus", emotion: "Emotion" };

// ── Beste Session ermitteln: Präferenz → History → Default ───────────────────
async function getBestSessionInfo() {
  try {
    // 1. Nutzer-Präferenzen aus Onboarding
    const { getUserPreferences } = require("./storage");
    const prefs = await getUserPreferences().catch(() => []);
    if (Array.isArray(prefs) && prefs.length > 0) {
      const firstPref = prefs[0];
      const sessionId = PREF_TO_SESSION[firstPref] || DEFAULT_SESSION_ID;
      const modeId = PREF_TO_MODE[firstPref] || "calm";
      return { sessionId, modeId };
    }

    // 2. Fallback: meistgenutzte Session aus History
    const history = await getSessionHistory();
    if (!Array.isArray(history) || history.length === 0) {
      return { sessionId: DEFAULT_SESSION_ID, modeId: "calm" };
    }
    const counts = {};
    for (const entry of history) {
      const sid = (entry && entry.sessionId) || (entry && entry.id);
      if (!sid || sid === "SOS" || sid === "__freeze__") continue;
      counts[sid] = (counts[sid] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const sessionId = sorted[0][0];
      const modeId = sessionId.split("-")[0] || "calm";
      return { sessionId, modeId };
    }
    return { sessionId: DEFAULT_SESSION_ID, modeId: "calm" };
  } catch (_e) {
    return { sessionId: DEFAULT_SESSION_ID, modeId: "calm" };
  }
}


function buildMorgenTexts(name, lang) {
  const isEN = lang === "en";
  const greeting = name ? `${name}, ` : "";
  const titles = isEN
    ? [
        `${greeting}good morning ☀️`,
        "A new day begins",
        `${greeting}your moment of calm`,
        "Start with stillness",
      ]
    : [
        `${greeting}Guten Morgen ☀️`,
        "Ein neuer Tag beginnt",
        `${greeting}dein Moment der Ruhe`,
        "Mit Stille in den Tag",
      ];
  const bodies = isEN
    ? [
        "Take 60 seconds for yourself before the day takes over.",
        "One mindful minute. That's all it takes.",
        "A calm start makes everything that follows easier.",
        "Your morning practice is waiting. Just one minute.",
      ]
    : [
        "Nimm dir 60 Sekunden für dich, bevor der Tag beginnt.",
        "Eine achtsame Minute. Mehr braucht es nicht.",
        "Ein ruhiger Start macht alles danach leichter.",
        "Deine Morgenpraxis wartet. Nur eine Minute.",
      ];
  return { title: randomFrom(titles), body: randomFrom(bodies) };
}

// ── Kern: beide täglichen Notifications planen ─────────────────────────────────
// iOS cached den Notification-Content bei repeats:true → immer gleicher Text.
// Fix: Wir planen 14 Einzel-Notifications (7 Tage × 2 Zeitpunkte) mit je
// unterschiedlichem Text. Nach 7 Tagen neu planen via scheduleFixedReminders().
export const scheduleFixedReminders = async () => {
  try {
    const enabled = await getReminderEnabled();
    if (!enabled) return { success: false, error: "disabled" };

    await ensureAndroidChannel();

    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) return { success: false, error: "permission-denied" };

    // Beste Session + Modus ermitteln
    const { sessionId: favSessionId, modeId: prefModeId } = await getBestSessionInfo();

    // Mittags: niemals sleep-Modus — immer calm oder focus
    const mittagModeId = (prefModeId === "sleep") ? "calm" : (prefModeId || "calm");
    const abendModeId = prefModeId || "calm";

    const mittagSessionId = mittagModeId === "focus" ? "focus-1" : "calm-1";
    const abendSessionId = favSessionId;

    const [userName, streak] = await Promise.all([
      getUserName().catch(() => null),
      getDailyStreak().catch(() => 0),
    ]);
    const lang = getLanguage();
    const modeNames = lang === "en" ? MODE_NAMES_EN : MODE_NAMES_DE;

    const mittagIcon = MODE_ICONS[mittagModeId] || "🌊";
    const mittagName = modeNames[mittagModeId] || "Calm";
    const abendIcon = MODE_ICONS[abendModeId] || "🌙";
    const abendName = modeNames[abendModeId] || "Calm";

    // Alte Notifications canceln
    const prevIds = await getIntervalReminderScheduledId();
    if (prevIds) {
      const ids = typeof prevIds === "string" ? JSON.parse(prevIds) : prevIds;
      for (const id of [].concat(ids)) {
        try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
      }
    }

    const androidExtras = Platform.OS === "android"
      ? { channelId: ANDROID_CHANNEL_ID, priority: Notifications.AndroidNotificationPriority.DEFAULT }
      : {};

    try {
      await Notifications.setNotificationCategoryAsync("stillmind-session", [
        {
          identifier: "START_SESSION",
          buttonTitle: lang === "en" ? `${abendIcon} Start ${abendName} →` : `${abendIcon} ${abendName} starten →`,
          options: { opensAppToForeground: true, isDestructive: false, isAuthenticationRequired: false },
        },
      ]);
    } catch (_) {}

    // 7 Tage vorausplanen (täglich 11:45 + 19:45) → 14 Einzel-Notifications
    // Jede bekommt einen anderen Text → kein Wiederholungs-Problem
    const scheduledIds = [];
    const now = new Date();

    for (let day = 0; day < 7; day++) {
      // Mittag 11:45
      const mittagDate = new Date(now);
      mittagDate.setDate(now.getDate() + day);
      mittagDate.setHours(11, 45, 0, 0);
      if (mittagDate.getTime() - now.getTime() > 60 * 1000) {
        const mittagContent = buildMittagTexts(userName, streak, mittagIcon, mittagName, lang);
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...mittagContent,
            sound: "default",
            categoryIdentifier: "stillmind-session",
            data: { sessionId: mittagSessionId, url: `stillmind://session-run/${mittagSessionId}`, action: "start_session" },
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: mittagDate,
          },
        });
        scheduledIds.push(id);
      }

      // Abend 19:45
      const abendDate = new Date(now);
      abendDate.setDate(now.getDate() + day);
      abendDate.setHours(19, 45, 0, 0);
      if (abendDate.getTime() - now.getTime() > 60 * 1000) {
        const abendContent = buildAbendTexts(userName, streak, abendIcon, abendName, lang);
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...abendContent,
            sound: "default",
            categoryIdentifier: "stillmind-session",
            data: { sessionId: abendSessionId, url: `stillmind://session-run/${abendSessionId}`, action: "start_session" },
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: abendDate,
          },
        });
        scheduledIds.push(id);
      }

      // Morgen 08:00
      const morgenDate = new Date(now);
      morgenDate.setDate(now.getDate() + day);
      morgenDate.setHours(8, 0, 0, 0);
      if (morgenDate.getTime() - now.getTime() > 60 * 1000) {
        const morgenContent = buildMorgenTexts(userName, lang);
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...morgenContent,
            sound: "default",
            categoryIdentifier: "stillmind-session",
            data: { sessionId: mittagSessionId, url: `stillmind://session-run/${mittagSessionId}`, action: "start_session" },
            ...androidExtras,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: morgenDate,
          },
        });
        scheduledIds.push(id);
      }

    }

    await setIntervalReminderScheduledId(JSON.stringify(scheduledIds));
    await setIntervalReminderNextAt(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());

    return {
      success: true,
      scheduled: scheduledIds.length,
      mittagMode: mittagModeId,
      abendMode: abendModeId,
    };
  } catch (error) {
    console.error("scheduleFixedReminders error:", error);
    return { success: false, error: "unknown" };
  }
};

export const enableIntervalReminder = async () => {
  await setReminderEnabled(true);
  return await scheduleFixedReminders();
};

export const disableIntervalReminder = async () => {
  try {
    await setReminderEnabled(false);
    const prevIds = await getIntervalReminderScheduledId();
    if (prevIds) {
      const ids = typeof prevIds === "string" ? JSON.parse(prevIds) : prevIds;
      for (const id of [].concat(ids)) {
        try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
      }
    }
    await setIntervalReminderScheduledId(null);
    await setIntervalReminderNextAt(null);
  } catch (_) {}
};

// Wird nach Session aufgerufen — bei fixen Zeiten nichts neu planen nötig
export const markSessionActivityForIntervalReminder = async () => {
  // Notifications laufen täglich automatisch — keine Aktion nötig
};

// Compat-Export für session-result (wird dort importiert aber nicht mehr gebraucht)
export const scheduleNextIntervalReminder = scheduleFixedReminders;

/* =========================
   Morgenimpuls (Quote-Push) – täglich 08:00
   ========================= */
const QUOTE_CHANNEL_ID = "stillmind-morgenimpuls";
const QUOTE_NOTIFICATION_ID_KEY = "quote_push_notification_id";

const QUOTES_DE = [
  "Ruhe ist keine Schwäche. Sie ist der Anfang von Stärke.",
  "60 Sekunden Stille können mehr verändern als eine Stunde Nachdenken.",
  "Du kannst den Sturm nicht stoppen – aber du kannst lernen, im Regen zu tanzen.",
  "Atme. Du bist bereits dort, wo du sein musst.",
  "Kleine Pausen schaffen großen Raum.",
  "Wer innehält, kommt weiter.",
  "Dein nächster Atemzug ist ein Neuanfang.",
  "Stärke entsteht nicht im Lärm, sondern in der Stille.",
  "Du brauchst keine perfekte Stimmung – nur eine Minute.",
  "Jeder Moment der Ruhe ist eine Investition in dich.",
  "Der Atem ist der Anker – er holt dich immer wieder zurück.",
  "Innehalten ist kein Verlieren. Es ist Besinnung.",
  "Du musst nicht alles auf einmal lösen. Atme zuerst.",
  "Die Stille zwischen zwei Gedanken ist der Ort, wo Klarheit wohnt.",
  "Heute reicht es, einen Schritt zu tun.",
  "Wer atmet, übersteht alles.",
  "Dein Körper weiß den Weg. Hör ihm zu.",
  "Manchmal ist Pause die produktivste Entscheidung.",
  "Du bist mehr als deine To-do-Liste.",
  "Jeden Tag ein Moment der Stille – das verändert alles.",
  "Nicht schneller, sondern bewusster.",
  "Im Atem liegt die Antwort auf vieles.",
  "Du musst nicht funktionieren. Du darfst einfach sein.",
  "Atme tief. Lass los. Neu beginnen.",
  "Die kleinen Momente sind es, die das Leben ausmachen.",
  "Vertraue dem Prozess. Vertraue dem Atem.",
  "Heute ist ein guter Tag, um loszulassen.",
  "Ruhe ist nicht Stillstand – sie ist Kraft.",
  "Was auch immer kommt – du hast Ressourcen in dir.",
  "Ein bewusster Atemzug kann einen ganzen Tag verändern.",
];

const QUOTES_EN = [
  "Stillness is not weakness. It's the beginning of strength.",
  "60 seconds of silence can change more than an hour of thinking.",
  "You can't stop the storm — but you can learn to dance in the rain.",
  "Breathe. You are already where you need to be.",
  "Small pauses create big space.",
  "Those who pause, go further.",
  "Your next breath is a fresh start.",
  "Strength is born not in noise, but in stillness.",
  "You don't need the perfect mood — just one minute.",
  "Every moment of calm is an investment in yourself.",
  "Your breath is an anchor — it always brings you back.",
  "Pausing is not losing. It's finding yourself.",
  "You don't have to solve everything at once. Breathe first.",
  "The silence between two thoughts is where clarity lives.",
  "Today, one step is enough.",
  "Those who breathe, endure everything.",
  "Your body knows the way. Listen to it.",
  "Sometimes a pause is the most productive decision.",
  "You are more than your to-do list.",
  "One moment of stillness every day changes everything.",
  "Not faster — more mindfully.",
  "In the breath lies the answer to much.",
  "You don't have to function. You're allowed to just be.",
  "Breathe deep. Let go. Begin again.",
  "It's the small moments that make life meaningful.",
  "Trust the process. Trust the breath.",
  "Today is a good day to let go.",
  "Rest is not stagnation — it is power.",
  "Whatever comes — you have resources within you.",
  "One conscious breath can change an entire day.",
];
const QUOTES_ES = [
  "La quietud no es debilidad. Es el comienzo de la fuerza.",
  "60 segundos de silencio pueden cambiar más que una hora de pensar.",
  "No puedes detener la tormenta, pero puedes aprender a bailar bajo la lluvia.",
  "Respira. Ya estás donde necesitas estar.",
  "Las pequeñas pausas crean grandes espacios.",
  "Quien hace pausas, llega más lejos.",
  "Tu próxima respiración es un nuevo comienzo.",
  "La fuerza no nace en el ruido, sino en la quietud.",
  "No necesitas el estado de ánimo perfecto, solo un minuto.",
  "Cada momento de calma es una inversión en ti mismo.",
  "Tu respiración es un ancla — siempre te trae de vuelta.",
  "Detenerse no es perder. Es encontrarte a ti mismo.",
  "No tienes que resolverlo todo a la vez. Primero respira.",
  "El silencio entre dos pensamientos es donde vive la claridad.",
  "Hoy, un paso es suficiente.",
  "Quien respira, lo supera todo.",
  "Tu cuerpo conoce el camino. Escúchalo.",
  "A veces una pausa es la decisión más productiva.",
  "Eres más que tu lista de tareas.",
  "Un momento de quietud cada día lo cambia todo.",
  "No más rápido — más conscientemente.",
  "En la respiración está la respuesta a mucho.",
  "No tienes que funcionar. Puedes simplemente ser.",
  "Respira hondo. Suelta. Comienza de nuevo.",
  "Son los pequeños momentos los que hacen la vida significativa.",
  "Confía en el proceso. Confía en la respiración.",
  "Hoy es un buen día para soltar.",
  "El descanso no es estancamiento — es poder.",
  "Lo que sea que venga — tienes recursos dentro de ti.",
  "Una respiración consciente puede cambiar todo un día.",
];

const QUOTES_ZH = [
  "静止不是软弱，而是力量的开始。",
  "60秒的沉默，比一小时的思考更能改变一切。",
  "你无法阻止风暴，但你可以学会在雨中起舞。",
  "呼吸。你已经在你需要的地方了。",
  "小小的停顿创造巨大的空间。",
  "懂得停顿的人，走得更远。",
  "你的下一次呼吸是一个新的开始。",
  "力量不是在喧嚣中诞生，而是在静止中。",
  "你不需要完美的心情，只需一分钟。",
  "每一刻的平静都是对自己的投资。",
  "你的呼吸是锚——它总能把你带回来。",
  "停下来不是失败，而是找到自己。",
  "你不必一次解决所有问题，先呼吸。",
  "两个思想之间的沉默，是清晰的居所。",
  "今天，一步就够了。",
  "会呼吸的人，能承受一切。",
  "你的身体知道方向，聆听它。",
  "有时候，暂停是最有效率的决定。",
  "你不只是一份待办清单。",
  "每天一刻宁静，改变一切。",
  "不是更快，而是更专注。",
  "答案就在呼吸之中。",
  "你不必运转如机器，你可以只是存在。",
  "深呼吸，放手，重新开始。",
  "正是那些小小的瞬间，让生命有意义。",
  "信任这个过程，信任呼吸。",
  "今天是放手的好日子。",
  "休息不是停滞，而是力量。",
  "无论发生什么，你内心都有资源。",
  "一次有意识的呼吸，可以改变整整一天。",
];

const QUOTES_FR = [
  "Le silence n'est pas une faiblesse. C'est le début de la force.",
  "60 secondes de silence peuvent changer plus qu'une heure de réflexion.",
  "Tu ne peux pas arrêter la tempête, mais tu peux apprendre à danser sous la pluie.",
  "Respire. Tu es déjà là où tu dois être.",
  "Les petites pauses créent de grands espaces.",
  "Celui qui fait des pauses va plus loin.",
  "Ta prochaine respiration est un nouveau départ.",
  "La force naît non dans le bruit, mais dans le silence.",
  "Tu n'as pas besoin de l'humeur parfaite, juste d'une minute.",
  "Chaque moment de calme est un investissement en toi-même.",
  "Ta respiration est une ancre — elle te ramène toujours.",
  "Faire une pause, ce n'est pas perdre. C'est te retrouver.",
  "Tu n'as pas à tout résoudre d'un coup. Respire d'abord.",
  "Le silence entre deux pensées est là où vit la clarté.",
  "Aujourd'hui, un pas suffit.",
  "Ceux qui respirent, surmontent tout.",
  "Ton corps connaît le chemin. Écoute-le.",
  "Parfois, une pause est la décision la plus productive.",
  "Tu es plus que ta liste de tâches.",
  "Un moment de silence par jour change tout.",
  "Pas plus vite — plus consciemment.",
  "Dans la respiration réside la réponse à beaucoup de choses.",
  "Tu n'as pas à fonctionner. Tu as le droit d'être simplement.",
  "Respire profondément. Lâche prise. Recommence.",
  "Ce sont les petits moments qui rendent la vie significative.",
  "Fais confiance au processus. Fais confiance à la respiration.",
  "Aujourd'hui est un bon jour pour lâcher prise.",
  "Le repos n'est pas une stagnation — c'est une force.",
  "Quoi qu'il arrive — tu as des ressources en toi.",
  "Une respiration consciente peut changer toute une journée.",
];

const QUOTES_PT = [
  "A quietude não é fraqueza. É o começo da força.",
  "60 segundos de silêncio podem mudar mais do que uma hora de pensamento.",
  "Não podes parar a tempestade, mas podes aprender a dançar na chuva.",
  "Respira. Já estás onde precisas de estar.",
  "Pequenas pausas criam grandes espaços.",
  "Quem faz pausas, vai mais longe.",
  "A tua próxima respiração é um novo começo.",
  "A força nasce não no ruído, mas na quietude.",
  "Não precisas do humor perfeito, apenas um minuto.",
  "Cada momento de calma é um investimento em ti mesmo.",
  "A tua respiração é uma âncora — ela sempre te traz de volta.",
  "Parar não é perder. É encontrar-te a ti mesmo.",
  "Não tens de resolver tudo de uma vez. Respira primeiro.",
  "O silêncio entre dois pensamentos é onde a clareza vive.",
  "Hoje, um passo é suficiente.",
  "Quem respira, supera tudo.",
  "O teu corpo conhece o caminho. Ouve-o.",
  "Às vezes uma pausa é a decisão mais produtiva.",
  "És mais do que a tua lista de tarefas.",
  "Um momento de silêncio por dia muda tudo.",
  "Não mais rápido — mais conscientemente.",
  "Na respiração está a resposta para muito.",
  "Não tens de funcionar. Podes simplesmente ser.",
  "Respira fundo. Deixa ir. Começa de novo.",
  "São os pequenos momentos que tornam a vida significativa.",
  "Confia no processo. Confia na respiração.",
  "Hoje é um bom dia para deixar ir.",
  "O descanso não é estagnação — é poder.",
  "O que quer que venha — tens recursos dentro de ti.",
  "Uma respiração consciente pode mudar um dia inteiro.",
];

const QUOTES_JA = [
  "静寂は弱さではない。それは強さの始まりだ。",
  "60秒の沈黙は、1時間の思考よりも多くを変えることができる。",
  "嵐を止めることはできないが、雨の中で踊ることは学べる。",
  "息をして。あなたはすでに必要な場所にいる。",
  "小さな休憩が大きな空間を作る。",
  "立ち止まる人は、より遠くへ行ける。",
  "次の呼吸は新しいスタートだ。",
  "強さは騒音からではなく、静けさから生まれる。",
  "完璧な気分は必要ない。ただ1分間だけ。",
  "穏やかな瞬間はすべて自分への投資だ。",
  "呼吸はアンカーだ——それはいつもあなたを引き戻してくれる。",
  "立ち止まることは負けではない。自分を見つけることだ。",
  "すべてを一度に解決する必要はない。まず息をして。",
  "二つの思考の間の静寂に、明晰さが宿る。",
  "今日は一歩で十分だ。",
  "息をする人は、すべてを乗り越えられる。",
  "体は道を知っている。耳を傾けて。",
  "時に休憩が最も生産的な決断だ。",
  "あなたはタスクリスト以上の存在だ。",
  "毎日一瞬の静けさがすべてを変える。",
  "速くではなく、意識的に。",
  "呼吸の中に多くの答えがある。",
  "機能し続けなくていい。ただ存在していいのだ。",
  "深く息を吸って。手放して。また始めよう。",
  "小さな瞬間が人生を意味あるものにする。",
  "プロセスを信頼して。呼吸を信頼して。",
  "今日は手放すのに良い日だ。",
  "休息は停滞ではない——それは力だ。",
  "何が来ても——あなたの中にリソースがある。",
  "一つの意識的な呼吸が一日全体を変えることができる。",
];

const QUOTES_KO = [
  "고요함은 약함이 아니다. 그것은 강함의 시작이다.",
  "60초의 침묵은 한 시간의 생각보다 더 많은 것을 바꿀 수 있다.",
  "폭풍을 멈출 수는 없지만, 빗속에서 춤추는 법을 배울 수 있다.",
  "숨을 쉬어라. 당신은 이미 있어야 할 곳에 있다.",
  "작은 휴식이 큰 공간을 만든다.",
  "멈추는 자가 더 멀리 간다.",
  "다음 호흡은 새로운 시작이다.",
  "힘은 소음이 아닌 고요함에서 태어난다.",
  "완벽한 기분이 필요하지 않다. 단 1분이면 된다.",
  "평온한 매 순간은 자신에 대한 투자다.",
  "호흡은 닻이다——항상 당신을 되돌아오게 한다.",
  "멈추는 것은 지는 것이 아니다. 자신을 찾는 것이다.",
  "모든 것을 한 번에 해결할 필요 없다. 먼저 숨을 쉬어라.",
  "두 생각 사이의 침묵에 명료함이 산다.",
  "오늘은 한 걸음이면 충분하다.",
  "숨 쉬는 자는 모든 것을 이겨낸다.",
  "몸은 길을 안다. 귀를 기울여라.",
  "때로는 휴식이 가장 생산적인 결정이다.",
  "당신은 할 일 목록 그 이상이다.",
  "매일 한 순간의 고요함이 모든 것을 바꾼다.",
  "더 빠르게가 아니라 더 의식적으로.",
  "숨결 속에 많은 답이 있다.",
  "작동해야 할 필요가 없다. 그냥 존재해도 된다.",
  "깊게 숨쉬고. 놓아버리고. 다시 시작하라.",
  "작은 순간들이 삶을 의미 있게 만든다.",
  "과정을 신뢰해라. 호흡을 신뢰해라.",
  "오늘은 놓아버리기 좋은 날이다.",
  "휴식은 정체가 아니다——그것은 힘이다.",
  "무엇이 오더라도——당신 안에 자원이 있다.",
  "한 번의 의식적인 호흡이 하루 전체를 바꿀 수 있다.",
];

const QUOTES_IT = [
  "La quiete non è debolezza. È l'inizio della forza.",
  "60 secondi di silenzio possono cambiare più di un'ora di pensieri.",
  "Non puoi fermare la tempesta, ma puoi imparare a ballare sotto la pioggia.",
  "Respira. Sei già dove devi essere.",
  "Le piccole pause creano grandi spazi.",
  "Chi fa delle pause, va più lontano.",
  "Il tuo prossimo respiro è un nuovo inizio.",
  "La forza nasce non nel rumore, ma nella quiete.",
  "Non hai bisogno dell'umore perfetto, solo un minuto.",
  "Ogni momento di calma è un investimento in te stesso.",
  "Il tuo respiro è un'ancora — ti riporta sempre indietro.",
  "Fermarsi non è perdere. È ritrovarsi.",
  "Non devi risolvere tutto in una volta. Prima respira.",
  "Il silenzio tra due pensieri è dove vive la chiarezza.",
  "Oggi, un passo è sufficiente.",
  "Chi respira, supera tutto.",
  "Il tuo corpo conosce la strada. Ascoltalo.",
  "A volte una pausa è la decisione più produttiva.",
  "Sei più della tua lista di cose da fare.",
  "Un momento di silenzio ogni giorno cambia tutto.",
  "Non più veloce — più consapevolmente.",
  "Nel respiro si trova la risposta a molto.",
  "Non devi funzionare. Puoi semplicemente essere.",
  "Respira profondamente. Lascia andare. Ricomincia.",
  "Sono i piccoli momenti a rendere la vita significativa.",
  "Fidati del processo. Fidati del respiro.",
  "Oggi è un buon giorno per lasciar andare.",
  "Il riposo non è stagnazione — è potere.",
  "Qualunque cosa venga — hai risorse dentro di te.",
  "Un respiro consapevole può cambiare un'intera giornata.",
];

const QUOTES_RU = [
  "Покой — не слабость. Это начало силы.",
  "60 секунд тишины могут изменить больше, чем час размышлений.",
  "Ты не можешь остановить шторм, но можешь научиться танцевать под дождём.",
  "Дыши. Ты уже там, где нужно быть.",
  "Маленькие паузы создают большое пространство.",
  "Тот, кто делает паузы, идёт дальше.",
  "Твой следующий вдох — это новое начало.",
  "Сила рождается не в шуме, а в тишине.",
  "Тебе не нужно идеальное настроение — только одна минута.",
  "Каждый момент спокойствия — это вложение в себя.",
  "Твоё дыхание — якорь, который всегда возвращает тебя.",
  "Остановиться — это не проиграть. Это найти себя.",
  "Не нужно решать всё сразу. Сначала просто дыши.",
  "Тишина между двумя мыслями — место, где живёт ясность.",
  "Сегодня достаточно сделать один шаг.",
  "Тот, кто дышит, переживает всё.",
  "Твоё тело знает путь. Прислушайся к нему.",
  "Иногда пауза — самое продуктивное решение.",
  "Ты больше, чем твой список дел.",
  "Один миг тишины каждый день меняет всё.",
  "Не быстрее — осознаннее.",
  "В дыхании кроется ответ на многое.",
  "Тебе не нужно функционировать. Ты можешь просто быть.",
  "Вдохни глубже. Отпусти. Начни снова.",
  "Именно маленькие моменты делают жизнь значимой.",
  "Доверяй процессу. Доверяй дыханию.",
  "Сегодня хороший день, чтобы отпустить.",
  "Отдых — не застой, это сила.",
  "Что бы ни пришло — у тебя есть ресурсы внутри.",
  "Один осознанный вдох может изменить целый день.",
];

const QUOTES_HI = [
  "शांति कमज़ोरी नहीं है। यह शक्ति की शुरुआत है।",
  "60 सेकंड की चुप्पी एक घंटे की सोच से ज़्यादा बदल सकती है।",
  "तूफान को नहीं रोक सकते, लेकिन बारिश में नाचना सीख सकते हैं।",
  "सांस लो। तुम पहले से वहीं हो जहां होना चाहिए।",
  "छोटे विराम बड़े स्थान बनाते हैं।",
  "जो रुकते हैं, वे आगे जाते हैं।",
  "तुम्हारी अगली सांस एक नई शुरुआत है।",
  "शक्ति शोर में नहीं, शांति में जन्म लेती है।",
  "तुम्हें सही मूड की जरूरत नहीं, बस एक मिनट चाहिए।",
  "शांति का हर पल अपने आप में निवेश है।",
  "तुम्हारी सांस एक लंगर है — यह हमेशा तुम्हें वापस लाती है।",
  "रुकना हारना नहीं है। यह खुद को खोजना है।",
  "सब कुछ एक साथ सुलझाने की जरूरत नहीं। पहले सांस लो।",
  "दो विचारों के बीच की चुप्पी में स्पष्टता रहती है।",
  "आज एक कदम ही काफी है।",
  "जो सांस लेते हैं, वो सब सह लेते हैं।",
  "तुम्हारा शरीर रास्ता जानता है। उसे सुनो।",
  "कभी-कभी एक विराम सबसे उत्पादक निर्णय होता है।",
  "तुम अपनी to-do list से कहीं ज़्यादा हो।",
  "हर दिन एक पल की शांति सब कुछ बदल देती है।",
  "तेज़ नहीं — सचेत रूप से।",
  "सांस में बहुत सारे सवालों के जवाब हैं।",
  "तुम्हें काम करते रहना ज़रूरी नहीं। बस होना काफी है।",
  "गहरी सांस लो। छोड़ दो। फिर से शुरू करो।",
  "छोटे-छोटे पल ही जीवन को अर्थ देते हैं।",
  "प्रक्रिया पर भरोसा रखो। सांस पर भरोसा रखो।",
  "आज छोड़ने का अच्छा दिन है।",
  "आराम ठहराव नहीं है — यह शक्ति है।",
  "जो भी आए — तुम्हारे अंदर संसाधन हैं।",
  "एक सचेत सांस पूरे दिन को बदल सकती है।",
];

const QUOTES_TR = [
  "Sessizlik zayıflık değildir. Bu, gücün başlangıcıdır.",
  "60 saniyelik sessizlik, bir saatlik düşünceden daha fazlasını değiştirebilir.",
  "Fırtınayı durduramazsın, ama yağmurda dans etmeyi öğrenebilirsin.",
  "Nefes al. Zaten olman gereken yerdesin.",
  "Küçük molalar büyük alan yaratır.",
  "Duraklayan daha ileri gider.",
  "Bir sonraki nefesin yeni bir başlangıç.",
  "Güç gürültüde değil, sessizlikte doğar.",
  "Mükemmel ruh haline ihtiyacın yok, sadece bir dakika.",
  "Her sakin an kendine yapılan bir yatırımdır.",
  "Nefes alman bir çapardır — seni her zaman geri getirir.",
  "Durmak kaybetmek değildir. Kendini bulmaktır.",
  "Her şeyi bir anda çözmen gerekmiyor. Önce nefes al.",
  "İki düşünce arasındaki sessizlik, berraklığın yaşadığı yerdir.",
  "Bugün bir adım yeterlidir.",
  "Nefes alanlar her şeyin üstesinden gelir.",
  "Vücudun yolu bilir. Onu dinle.",
  "Bazen bir mola en verimli karardır.",
  "Yapılacaklar listenden çok daha fazlasısın.",
  "Her gün bir sessizlik anı her şeyi değiştirir.",
  "Daha hızlı değil — daha bilinçli.",
  "Nefeste pek çok şeyin cevabı yatmaktadır.",
  "İşlev görmek zorunda değilsin. Sadece var olabilirsin.",
  "Derin nefes al. Bırak git. Yeniden başla.",
  "Hayatı anlamlı kılan küçük anlardır.",
  "Sürece güven. Nefese güven.",
  "Bugün bırakmak için iyi bir gün.",
  "Dinlenme durgunluk değil — güçtür.",
  "Her ne gelirse — içinde kaynaklar var.",
  "Bilinçli bir nefes tüm bir günü değiştirebilir.",
];

const QUOTES_NL = [
  "Stilte is geen zwakte. Het is het begin van kracht.",
  "60 seconden stilte kunnen meer veranderen dan een uur nadenken.",
  "Je kunt de storm niet stoppen, maar je kunt leren dansen in de regen.",
  "Adem. Je bent al waar je moet zijn.",
  "Kleine pauzes creëren grote ruimte.",
  "Wie pauzeert, komt verder.",
  "Je volgende ademhaling is een nieuw begin.",
  "Kracht wordt niet geboren in lawaai, maar in stilte.",
  "Je hebt de perfecte stemming niet nodig, alleen één minuut.",
  "Elk moment van rust is een investering in jezelf.",
  "Je ademhaling is een anker — het brengt je altijd terug.",
  "Stoppen is niet verliezen. Het is jezelf vinden.",
  "Je hoeft niet alles tegelijk op te lossen. Adem eerst.",
  "De stilte tussen twee gedachten is waar helderheid woont.",
  "Vandaag is één stap genoeg.",
  "Wie ademt, overleeft alles.",
  "Je lichaam kent de weg. Luister ernaar.",
  "Soms is een pauze de meest productieve beslissing.",
  "Je bent meer dan je takenlijst.",
  "Één moment van stilte per dag verandert alles.",
  "Niet sneller — bewuster.",
  "In de adem ligt het antwoord op veel.",
  "Je hoeft niet te functioneren. Je mag gewoon zijn.",
  "Adem diep. Laat los. Begin opnieuw.",
  "Het zijn de kleine momenten die het leven zinvol maken.",
  "Vertrouw het proces. Vertrouw de adem.",
  "Vandaag is een goede dag om los te laten.",
  "Rust is geen stilstand — het is kracht.",
  "Wat er ook komt — jij hebt middelen in je.",
  "Eén bewuste ademhaling kan een hele dag veranderen.",
];

const QUOTES_PL = [
  "Spokój to nie słabość. To początek siły.",
  "60 sekund ciszy może zmienić więcej niż godzina myślenia.",
  "Nie możesz zatrzymać burzy, ale możesz nauczyć się tańczyć w deszczu.",
  "Oddychaj. Jesteś już tam, gdzie powinieneś być.",
  "Małe przerwy tworzą wielką przestrzeń.",
  "Kto robi przerwy, idzie dalej.",
  "Twój następny oddech to nowy początek.",
  "Siła rodzi się nie w hałasie, lecz w spokoju.",
  "Nie potrzebujesz idealnego nastroju, tylko jednej minuty.",
  "Każda chwila spokoju to inwestycja w siebie.",
  "Twój oddech to kotwica — zawsze cię przywraca.",
  "Zatrzymanie się to nie porażka. To odnalezienie siebie.",
  "Nie musisz rozwiązywać wszystkiego naraz. Najpierw oddychaj.",
  "Cisza między dwoma myślami to miejsce, gdzie mieszka jasność.",
  "Dziś jeden krok wystarczy.",
  "Kto oddycha, znosi wszystko.",
  "Twoje ciało zna drogę. Posłuchaj go.",
  "Czasem przerwa to najbardziej produktywna decyzja.",
  "Jesteś czymś więcej niż listą zadań.",
  "Jeden moment ciszy dziennie zmienia wszystko.",
  "Nie szybciej — bardziej świadomie.",
  "W oddechu kryje się odpowiedź na wiele pytań.",
  "Nie musisz funkcjonować. Możesz po prostu być.",
  "Oddech głęboko. Puść. Zacznij od nowa.",
  "To małe chwile nadają życiu sens.",
  "Ufaj procesowi. Ufaj oddechowi.",
  "Dziś jest dobry dzień, żeby puścić.",
  "Odpoczynek to nie stagnacja — to siła.",
  "Cokolwiek przyjdzie — masz w sobie zasoby.",
  "Jeden świadomy oddech może zmienić cały dzień.",
];

const QUOTES_SV = [
  "Stillhet är inte svaghet. Det är styrkas början.",
  "60 sekunders tystnad kan förändra mer än en timmes tänkande.",
  "Du kan inte stoppa stormen, men du kan lära dig dansa i regnet.",
  "Andas. Du är redan där du behöver vara.",
  "Små pauser skapar stort utrymme.",
  "Den som pausar, kommer längre.",
  "Ditt nästa andetag är en ny början.",
  "Styrka föds inte i buller, utan i stillhet.",
  "Du behöver inte det perfekta humöret, bara en minut.",
  "Varje stund av lugn är en investering i dig själv.",
  "Din andning är ett ankare — den tar alltid tillbaka dig.",
  "Att stanna upp är inte att förlora. Det är att hitta sig själv.",
  "Du behöver inte lösa allt på en gång. Andas först.",
  "Tystnaden mellan två tankar är där klarhet bor.",
  "Idag räcker ett steg.",
  "Den som andas, klarar allt.",
  "Din kropp känner vägen. Lyssna på den.",
  "Ibland är en paus det mest produktiva beslutet.",
  "Du är mer än din att-göra-lista.",
  "Ett ögonblick av stillhet varje dag förändrar allt.",
  "Inte snabbare — mer medvetet.",
  "I andetaget finns svaret på mycket.",
  "Du behöver inte fungera. Du får bara vara.",
  "Andas djupt. Släpp taget. Börja om.",
  "Det är de små stunderna som gör livet meningsfullt.",
  "Lita på processen. Lita på andetaget.",
  "Idag är en bra dag att släppa taget.",
  "Vila är inte stagnation — det är kraft.",
  "Vad som än kommer — du har resurser inom dig.",
  "Ett medvetet andetag kan förändra en hel dag.",
];

const QUOTES_HE = [
  "שקט אינו חולשה. זהו תחילתה של עוצמה.",
  "60 שניות של שקט יכולות לשנות יותר משעה של מחשבה.",
  "אי אפשר לעצור את הסערה, אבל אפשר ללמוד לרקוד בגשם.",
  "נשום. אתה כבר במקום שאתה צריך להיות.",
  "הפסקות קטנות יוצרות מרחב גדול.",
  "מי שעוצר, מגיע רחוק יותר.",
  "הנשימה הבאה שלך היא התחלה חדשה.",
  "הכוח לא נולד ברעש, אלא בשקט.",
  "אינך צריך את מצב הרוח המושלם, רק דקה אחת.",
  "כל רגע של שלווה הוא השקעה בעצמך.",
  "הנשימה שלך היא עוגן — היא תמיד מחזירה אותך.",
  "לעצור זה לא להפסיד. זה למצוא את עצמך.",
  "אינך צריך לפתור הכל בבת אחת. קודם כל נשום.",
  "השקט בין שתי מחשבות הוא המקום בו בהירות גרה.",
  "היום, צעד אחד מספיק.",
  "מי שנושם, שורד הכל.",
  "גופך מכיר את הדרך. הקשב לו.",
  "לפעמים הפסקה היא ההחלטה הפרודוקטיבית ביותר.",
  "אתה יותר מרשימת המשימות שלך.",
  "רגע אחד של שקט כל יום משנה הכל.",
  "לא מהר יותר — במודעות רבה יותר.",
  "בנשימה טמונה התשובה לרבות מהשאלות.",
  "אינך חייב לתפקד. אתה יכול פשוט להיות.",
  "נשום עמוק. שחרר. התחל מחדש.",
  "אלה הרגעים הקטנים שנותנים משמעות לחיים.",
  "סמוך על התהליך. סמוך על הנשימה.",
  "היום הוא יום טוב לשחרר.",
  "מנוחה אינה קיפאון — זו עוצמה.",
  "מה שיבוא — יש בך משאבים.",
  "נשימה מודעת אחת יכולה לשנות יום שלם.",
];


async function ensureQuoteChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(QUOTE_CHANNEL_ID, {
      name: "StillMind Morgenimpuls",  // internal Android channel name, no translation needed
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      description: "Daily morning quote from StillMind",
    });
  } catch (_) {}
}

export const enableQuotePush = async () => {
  try {
    await ensureQuoteChannel();
    const lang = getLanguage();
    const quotesMap = { de: QUOTES_DE, en: QUOTES_EN, es: QUOTES_ES, zh: QUOTES_ZH, fr: QUOTES_FR, pt: QUOTES_PT, ja: QUOTES_JA, ko: QUOTES_KO, it: QUOTES_IT, ru: QUOTES_RU, hi: QUOTES_HI, tr: QUOTES_TR, nl: QUOTES_NL, pl: QUOTES_PL, sv: QUOTES_SV, he: QUOTES_HE };
    const quotes = quotesMap[lang] || QUOTES_EN;
    const androidConf = Platform.OS === "android" ? { channelId: QUOTE_CHANNEL_ID } : {};

    // Alte IDs canceln
    const storageMod = require("@react-native-async-storage/async-storage");
    const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
    const prevRaw = await AsyncStorage.getItem(QUOTE_NOTIFICATION_ID_KEY).catch(() => null);
    if (prevRaw) {
      try {
        const prevIds = JSON.parse(prevRaw);
        for (const id of [].concat(prevIds)) {
          try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
        }
      } catch (_) {}
    }

    // 7 verschiedene Zitate für 7 Tage vorausplanen
    const now = new Date();
    const scheduledIds = [];

    for (let day = 0; day < 7; day++) {
      const triggerDate = new Date(now);
      triggerDate.setDate(now.getDate() + day);
      triggerDate.setHours(8, 0, 0, 0);
      // Heute schon vorbei → überspringen
      if (triggerDate.getTime() - now.getTime() < 60 * 1000) continue;

      // Zufälliges Zitat, kein Wiederholungs-Problem
      const quote = quotes[Math.floor(Math.random() * quotes.length)];

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "StillMind",
          body: quote,
          sound: "default",
          ...androidConf,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      scheduledIds.push(id);
    }

    await AsyncStorage.setItem(QUOTE_NOTIFICATION_ID_KEY, JSON.stringify(scheduledIds));
    return { success: true, scheduled: scheduledIds.length };
  } catch (e) {
    return { success: false };
  }
};

export const disableQuotePush = async () => {
  try {
    const storageMod = require("@react-native-async-storage/async-storage");
    const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
    const raw = await AsyncStorage.getItem(QUOTE_NOTIFICATION_ID_KEY);
    if (raw) {
      try {
        const ids = JSON.parse(raw);
        for (const id of [].concat(ids)) {
          try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
        }
      } catch (_) {}
      await AsyncStorage.removeItem(QUOTE_NOTIFICATION_ID_KEY);
    }
  } catch (_) {}
};
