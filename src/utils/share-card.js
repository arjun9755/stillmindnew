import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Share, Platform } from "react-native";
import { getLanguage } from "./i18n";
import { getDailyStreak, getSessionHistory, getUserName } from "@/utils/storage";
import { LOGO_TRANSPARENT_B64 } from "@/utils/logo-b64";

const MODE_CONFIG = {
  calm: {
    color: "#4A90D9", soft: "rgba(74,144,217,0.14)", border: "rgba(74,144,217,0.28)",
    gradient: "linear-gradient(180deg, #07111A 0%, #081A28 100%)", icon: "🌊",
    label: { de: "Stress reduzieren", en: "Reduce stress" },
    subline: { de: "Atem. Körper. Jetzt.", en: "Breath. Body. Now." },
    cta: { de: "Jetzt kostenlos runterladen", en: "Download free now", es: "Descarga gratis ahora", zh: "立即免费下载", fr: "Télécharger gratuitement", pt: "Baixar grátis agora", ja: "今すぐ無料ダウンロード", ko: "지금 무료로 다운로드", it: "Scarica gratis ora", ru: "Скачать бесплатно", hi: "अभी मुफ्त डाउनलोड करें", tr: "Şimdi ücretsiz indir", nl: "Nu gratis downloaden", pl: "Pobierz za darmo", sv: "Ladda ner gratis nu", he: "הורד עכשיו בחינם" },
    ctaUrl: "stillmind.app",
  },
  focus: {
    color: "#DCA028", soft: "rgba(220,160,40,0.14)", border: "rgba(220,160,40,0.28)",
    gradient: "linear-gradient(180deg, #161005 0%, #231805 100%)", icon: "🎯",
    label: { de: "Fokus & Klarheit", en: "Focus & clarity" },
    subline: { de: "Konzentriert. Präsent. Bereit.", en: "Focused. Present. Ready." },
    cta: { de: "Fokus-Routine starten", en: "Start focus routine" },
    ctaUrl: "stillmind.app",
  },
  sleep: {
    color: "#8B7CFF", soft: "rgba(139,124,255,0.14)", border: "rgba(139,124,255,0.28)",
    gradient: "linear-gradient(180deg, #0E0D1A 0%, #171427 100%)", icon: "🌙",
    label: { de: "Besser einschlafen", en: "Sleep better" },
    subline: { de: "Loslassen. Einschlafen. Erholen.", en: "Let go. Fall asleep. Recover." },
    cta: { de: "Schlaf-Routine testen", en: "Try sleep routine" },
    ctaUrl: "stillmind.app",
  },
  emotion: {
    color: "#4CAF82", soft: "rgba(76,175,130,0.14)", border: "rgba(76,175,130,0.28)",
    gradient: "linear-gradient(180deg, #09150F 0%, #102319 100%)", icon: "💚",
    label: { de: "Emotionen beruhigen", en: "Calm emotions" },
    subline: { de: "Fühlen. Annehmen. Weitergehen.", en: "Feel. Accept. Move on." },
    cta: { de: "Mehr innere Ruhe", en: "More inner calm" },
    ctaUrl: "stillmind.app",
  },
  parent: {
    color: "#E88C60", soft: "rgba(232,140,96,0.14)", border: "rgba(232,140,96,0.28)",
    gradient: "linear-gradient(180deg, #1A100B 0%, #25140C 100%)", icon: "👨‍👩‍👧",
    label: { de: "Familien-Stress", en: "Family stress" },
    subline: { de: "Eine kleine Pause nur für dich.", en: "A small break just for you." },
    cta: { de: "Deine Auszeit", en: "Your time out" },
    ctaUrl: "stillmind.app",
  },
  work: {
    color: "#A98B6D", soft: "rgba(169,139,109,0.14)", border: "rgba(169,139,109,0.28)",
    gradient: "linear-gradient(180deg, #14100B 0%, #1F1811 100%)", icon: "☕",
    label: { de: "Pause im Alltag", en: "Daily break" },
    subline: { de: "Kurz raus. Tief durchatmen.", en: "Step out. Breathe deep." },
    cta: { de: "Deine Alltagspause", en: "Your daily pause" },
    ctaUrl: "stillmind.app",
  },
  thoughts: {
    color: "#B77CFF", soft: "rgba(183,124,255,0.14)", border: "rgba(183,124,255,0.28)",
    gradient: "linear-gradient(180deg, #120B1A 0%, #1C1126 100%)", icon: "🧠",
    label: { de: "Gedanken beruhigen", en: "Calm your thoughts" },
    subline: { de: "Weniger Lärm im Kopf.", en: "Less noise in your head." },
    cta: { de: "Kopf frei bekommen", en: "Clear your mind" },
    ctaUrl: "stillmind.app",
  },
};

function localise(obj, lang) {
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.de || "";
}

const DEFAULT_MODE = MODE_CONFIG.calm;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveMode(modeId, lang = "de") {
  const base = (modeId && typeof modeId === "string" && MODE_CONFIG[modeId]) ? MODE_CONFIG[modeId] : MODE_CONFIG.calm;
  return {
    ...base,
    label: localise(base.label, lang),
    subline: localise(base.subline, lang),
    cta: localise(base.cta, lang),
  };
}

function getTimeContext(timestamp, lang = "de") {
  const h = new Date(timestamp || Date.now()).getHours();
  const timeMap = {
    morning: {
      de: ["Guten Morgen", "Ein ruhiger Start in den Tag"],
      en: ["Good morning", "A calm start to the day"],
      es: ["Buenos días", "Un comienzo tranquilo"],
      zh: ["早上好", "平静地开始新的一天"],
      fr: ["Bonjour", "Un début calme de la journée"],
      pt: ["Bom dia", "Um começo tranquilo"],
      ja: ["おはようございます", "穏やかな一日の始まり"],
      ko: ["좋은 아침", "고요한 하루의 시작"],
      it: ["Buongiorno", "Un inizio tranquillo"],
      ru: ["Доброе утро", "Спокойное начало дня"],
      hi: ["सुप्रभात", "दिन की शांत शुरुआत"],
      tr: ["Günaydın", "Huzurlu bir başlangıç"],
      nl: ["Goedemorgen", "Een rustig begin"],
      pl: ["Dzień dobry", "Spokojny początek dnia"],
      sv: ["God morgon", "En lugn start på dagen"],
      he: ["בוקר טוב", "התחלה שקטה של היום"],
    },
    forenoon: {
      de: ["Vormittag", "Kurz ankommen und sammeln"],
      en: ["Morning", "Settle in and gather yourself"],
      es: ["Mañana", "Tómate un momento"],
      zh: ["上午", "片刻安静，收拾心情"],
      fr: ["Matinée", "Prendre un moment pour soi"],
      pt: ["Manhã", "Um momento para si"],
      ja: ["午前", "少し落ち着いて"],
      ko: ["오전", "잠시 정착하세요"],
      it: ["Mattina", "Prenditi un momento"],
      ru: ["Утро", "Момент для себя"],
      hi: ["सुबह", "एक पल रुकें"],
      tr: ["Sabah", "Bir an için dur"],
      nl: ["Ochtend", "Even tot rust komen"],
      pl: ["Poranek", "Chwila dla siebie"],
      sv: ["Förmiddag", "Ta ett ögonblick"],
      he: ["בוקר", "רגע לעצמך"],
    },
    noon: {
      de: ["Mittag", "Ein bewusster Moment zwischendurch"],
      en: ["Midday", "A mindful moment in between"],
      es: ["Mediodía", "Un momento consciente"],
      zh: ["中午", "正念片刻"],
      fr: ["Midi", "Un moment de pleine conscience"],
      pt: ["Meio-dia", "Um momento consciente"],
      ja: ["正午", "意識的な一息"],
      ko: ["정오", "의식적인 순간"],
      it: ["Mezzogiorno", "Un momento consapevole"],
      ru: ["Полдень", "Осознанный момент"],
      hi: ["दोपहर", "एक जागरूक पल"],
      tr: ["Öğlen", "Bilinçli bir an"],
      nl: ["Middag", "Een bewust moment"],
      pl: ["Południe", "Świadoma chwila"],
      sv: ["Middag", "Ett medvetet ögonblick"],
      he: ["צהריים", "רגע מודע"],
    },
    afternoon: {
      de: ["Nachmittag", "Neue Ruhe für den Rest des Tages"],
      en: ["Afternoon", "Fresh calm for the rest of the day"],
      es: ["Tarde", "Nueva calma para el resto del día"],
      zh: ["下午", "为今天余下时光注入平静"],
      fr: ["Après-midi", "Calme pour le reste de la journée"],
      pt: ["Tarde", "Nova calma para o resto do dia"],
      ja: ["午後", "残りの時間のための静けさ"],
      ko: ["오후", "하루의 나머지를 위한 평온"],
      it: ["Pomeriggio", "Nuova calma per il resto del giorno"],
      ru: ["День", "Свежее спокойствие"],
      hi: ["दोपहर बाद", "बाकी दिन के लिए शांति"],
      tr: ["Öğleden sonra", "Günün geri kalanı için huzur"],
      nl: ["Middag", "Nieuwe rust voor de rest van de dag"],
      pl: ["Popołudnie", "Nowy spokój na resztę dnia"],
      sv: ["Eftermiddag", "Ny ro för resten av dagen"],
      he: ["אחר הצהריים", "רוגע חדש לשאר היום"],
    },
    evening: {
      de: ["Guten Abend", "Entspannt in die Nacht"],
      en: ["Good evening", "Relaxed into the night"],
      es: ["Buenas noches", "Relajado hacia la noche"],
      zh: ["晚上好", "放松进入夜晚"],
      fr: ["Bonsoir", "Détendu vers la nuit"],
      pt: ["Boa noite", "Relaxado para a noite"],
      ja: ["こんばんは", "リラックスして夜へ"],
      ko: ["좋은 저녁", "편안하게 밤으로"],
      it: ["Buonasera", "Rilassato verso la notte"],
      ru: ["Добрый вечер", "Расслабленно в ночь"],
      hi: ["शुभ संध्या", "रात में आराम"],
      tr: ["İyi akşamlar", "Rahat bir geceye"],
      nl: ["Goedenavond", "Ontspannen de nacht in"],
      pl: ["Dobry wieczór", "Spokojnie w noc"],
      sv: ["God kväll", "Avslappnad in i natten"],
      he: ["ערב טוב", "נרגע לקראת הלילה"],
    },
    night: {
      de: ["Nacht", "Stille vor dem Schlaf"],
      en: ["Night", "Stillness before sleep"],
      es: ["Noche", "Quietud antes de dormir"],
      zh: ["夜晚", "入睡前的宁静"],
      fr: ["Nuit", "Silence avant le sommeil"],
      pt: ["Noite", "Silêncio antes de dormir"],
      ja: ["夜", "眠りの前の静けさ"],
      ko: ["밤", "잠들기 전의 고요함"],
      it: ["Notte", "Silenzio prima del sonno"],
      ru: ["Ночь", "Тишина перед сном"],
      hi: ["रात", "सोने से पहले शांति"],
      tr: ["Gece", "Uyku öncesi sessizlik"],
      nl: ["Nacht", "Stilte voor het slapen"],
      pl: ["Noc", "Cisza przed snem"],
      sv: ["Natt", "Stillhet innan sömnen"],
      he: ["לילה", "שקט לפני השינה"],
    },
  };
  let key = "night";
  if (h >= 5 && h < 9) key = "morning";
  else if (h >= 9 && h < 12) key = "forenoon";
  else if (h >= 12 && h < 14) key = "noon";
  else if (h >= 14 && h < 18) key = "afternoon";
  else if (h >= 18 && h < 22) key = "evening";
  const texts = (timeMap[key][lang] || timeMap[key].en);
  return { label: texts[0], sub: texts[1] };
}

function streakText(streak, lang = "de") {
  if (!streak || streak < 2) return null;
  const l = {
    de: [`${streak} Tage Streak`, `${streak} Tage am Stück`, `${streak} Tage Fokus`],
    en: [`${streak} day streak`, `${streak} days in a row`, `${streak} days of focus`],
    es: [`${streak} días seguidos`, `${streak} días consecutivos`, `${streak} días de enfoque`],
    zh: [`${streak}天连续`, `${streak}天坚持`, `${streak}天专注`],
    fr: [`${streak} jours de suite`, `${streak} jours consécutifs`, `${streak} jours de focus`],
    pt: [`${streak} dias seguidos`, `${streak} dias consecutivos`, `${streak} dias de foco`],
    ja: [`${streak}日連続`, `${streak}日間継続`, `${streak}日間集中`],
    ko: [`${streak}일 연속`, `${streak}일 연속 달성`, `${streak}일 집중`],
    it: [`${streak} giorni di fila`, `${streak} giorni consecutivi`, `${streak} giorni di focus`],
    ru: [`${streak} дней подряд`, `${streak} дней подряд`, `${streak} дней фокуса`],
    hi: [`${streak} दिन लगातार`, `${streak} दिन एक के बाद`, `${streak} दिन फोकस`],
    tr: [`${streak} gün streak`, `${streak} gün üst üste`, `${streak} günlük odak`],
    nl: [`${streak} dagen streak`, `${streak} dagen op rij`, `${streak} dagen focus`],
    pl: [`${streak} dni streak`, `${streak} dni z rzędu`, `${streak} dni skupienia`],
    sv: [`${streak} dagars streak`, `${streak} dagar i rad`, `${streak} dagars fokus`],
    he: [`${streak} ימים ברצף`, `${streak} ימים רצופים`, `${streak} ימי מיקוד`],
  };
  const labels = l[lang] || l.en;
  if (streak < 7) return labels[0];
  if (streak < 30) return labels[1];
  return labels[2];
}

function buildUserLine(userName, mins, lang = "de") {
  const wn = {
    de: `${userName} hat sich bewusst einen ruhigen Moment genommen.`,
    en: `${userName} took a mindful moment for themselves.`,
    es: `${userName} tomó un momento consciente para sí mismo.`,
    zh: `${userName}有意识地给自己一个安静的时刻。`,
    fr: `${userName} a pris un moment de pleine conscience.`,
    pt: `${userName} fez uma pausa consciente para si.`,
    ja: `${userName}さんが意識的に静かな時間を取りました。`,
    ko: `${userName}님이 의식적으로 조용한 순간을 가졌습니다.`,
    it: `${userName} si è preso un momento consapevole.`,
    ru: `${userName} осознанно взял момент для себя.`,
    hi: `${userName} ने जानबूझकर एक शांत पल लिया।`,
    tr: `${userName} kendine bilinçli bir an ayırdı.`,
    nl: `${userName} nam bewust een rustig moment voor zichzelf.`,
    pl: `${userName} świadomie wziął chwilę dla siebie.`,
    sv: `${userName} tog ett medvetet ögonblick för sig själv.`,
    he: `${userName} לקח רגע מודע לעצמו.`,
  };
  const nn = {
    de: `${mins} Minute${mins === 1 ? "" : "n"} ganz bei dir.`,
    en: `${mins} minute${mins === 1 ? "" : "s"} just for you.`,
    es: `${mins} minuto${mins === 1 ? "" : "s"} solo para ti.`,
    zh: `${mins}分钟，专属于你。`,
    fr: `${mins} minute${mins === 1 ? "" : "s"} rien que pour toi.`,
    pt: `${mins} minuto${mins === 1 ? "" : "s"} só para ti.`,
    ja: `${mins}分間、あなただけのために。`,
    ko: `${mins}분, 오직 당신을 위해.`,
    it: `${mins} minuto${mins === 1 ? "" : "i"} solo per te.`,
    ru: `${mins} минут${mins === 1 ? "а" : ""} только для тебя.`,
    hi: `${mins} मिनट सिर्फ आपके लिए।`,
    tr: `${mins} dakika sadece senin için.`,
    nl: `${mins} minuut${mins === 1 ? "" : "en"} alleen voor jou.`,
    pl: `${mins} minuta${mins === 1 ? "" : " tylko"} dla ciebie.`,
    sv: `${mins} minut${mins === 1 ? "" : "er"} bara för dig.`,
    he: `${mins} דקות רק בשבילך.`,
  };
  if (userName) return wn[lang] || wn.en;
  return nn[lang] || nn.en;
}

function formatDate(timestamp) {
  const d = new Date(timestamp || Date.now());
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp || Date.now());
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildShareCardHtml({ modeId, durationMinutes, timestamp, sessionTitle, quote, userName, streak, logoUri }) {
  const lang = getLanguage() || "de";
  const cfg = resolveMode(modeId, lang);
  const mins = Math.max(1, Number(durationMinutes) || 1);
  const timeCtx = getTimeContext(timestamp, lang);
  const modeName = escapeHtml((sessionTitle && String(sessionTitle).trim()) || cfg.label);
  const dateStr = escapeHtml(formatDate(timestamp));
  const timeStr = escapeHtml(formatTime(timestamp));
  const quoteText = escapeHtml((quote || cfg.subline || "Ein bewusster Moment für dich.").slice(0, 140));
  const userLine = escapeHtml(buildUserLine(userName, mins, lang));
  const streakTx = streakText(streak, lang);
  const logoSrc = logoUri && !String(logoUri).startsWith("data:image") ? `data:image/png;base64,${logoUri}` : (logoUri || LOGO_TRANSPARENT_B64);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1080,initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 1080px 1920px; margin: 0; }
    html, body {
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background: #05080B;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }
    .card {
      width: 1080px;
      height: 1920px;
      padding: 88px 72px;
      background: ${cfg.gradient};
      color: #fff;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: ${cfg.color};
    }
    .frame {
      width: 100%;
      height: 100%;
      border-radius: 42px;
      border: 2px solid ${cfg.border};
      background: linear-gradient(180deg, rgba(4,10,16,0.92) 0%, rgba(7,18,28,0.92) 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 88px 68px 56px;
      position: relative;
    }
    .logo {
      width: 170px;
      height: 170px;
      object-fit: contain;
      margin-bottom: 34px;
    }
    .meta {
      font-size: 26px;
      color: rgba(255,255,255,0.34);
      margin-bottom: 34px;
    }
    .tod-label {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 7px;
      text-transform: uppercase;
      color: ${cfg.color};
      margin-bottom: 10px;
    }
    .tod-sub {
      font-size: 28px;
      color: rgba(255,255,255,0.42);
      margin-bottom: 34px;
    }
    .mode-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 18px 30px;
      border-radius: 999px;
      background: ${cfg.soft};
      border: 2px solid ${cfg.border};
      margin-bottom: 44px;
      max-width: 820px;
    }
    .mode-icon { font-size: 34px; line-height: 1; }
    .mode-text {
      font-size: 28px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      line-height: 1.25;
    }
    .hero {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .hero-number {
      font-size: 176px;
      font-weight: 700;
      line-height: 0.85;
      letter-spacing: -5px;
      color: rgba(255,255,255,0.97);
    }
    .hero-unit {
      font-size: 54px;
      color: rgba(255,255,255,0.34);
      margin-bottom: 20px;
    }
    .user-line {
      font-size: 26px;
      color: rgba(255,255,255,0.56);
      line-height: 1.45;
      max-width: 780px;
      margin-bottom: 44px;
    }
    .quote {
      width: 100%;
      border-radius: 24px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      padding: 30px 34px;
      font-size: 26px;
      font-style: italic;
      line-height: 1.55;
      color: rgba(255,255,255,0.78);
      margin-bottom: 38px;
    }
    .stats {
      width: 100%;
      display: flex;
      gap: 18px;
      margin-bottom: 36px;
    }
    .stat {
      flex: 1;
      min-height: 154px;
      border-radius: 22px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .stat-label {
      font-size: 18px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.24);
      margin-bottom: 12px;
    }
    .stat-value {
      font-size: 48px;
      font-weight: 700;
      color: ${cfg.color};
      line-height: 1;
    }
    .stat-sub {
      font-size: 24px;
      color: rgba(255,255,255,0.28);
      margin-top: 8px;
      text-align: center;
      line-height: 1.2;
    }
    .streak {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 999px;
      padding: 14px 24px;
      background: rgba(255,160,0,0.12);
      border: 1px solid rgba(255,160,0,0.24);
      color: rgba(255,190,80,0.96);
      font-size: 24px;
      margin-bottom: 28px;
    }
    .footer {
      width: calc(100% + 136px);
      margin: auto -68px -56px;
      padding: 28px 40px;
      background: rgba(11, 28, 45, 0.72);
      border-top: 1px solid ${cfg.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .footer-left {
      text-align: left;
    }
    .footer-title {
      font-size: 30px;
      font-weight: 600;
      color: ${cfg.color};
      margin-bottom: 4px;
    }
    .footer-url {
      font-size: 20px;
      color: rgba(255,255,255,0.34);
    }
    .footer-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }
    .footer-stores {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .footer-store-badge {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(255,255,255,0.09);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      padding: 6px 14px;
    }
    .footer-store-icon {
      font-size: 20px;
    }
    .footer-store-label {
      font-size: 18px;
      font-weight: 600;
      color: rgba(255,255,255,0.70);
    }
    .footer-social {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .footer-social-handle {
      font-size: 18px;
      color: rgba(255,255,255,0.38);
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="line"></div>
    <div class="frame">
      <img class="logo" src="${logoSrc}" alt="StillMind" />
      <div class="meta">${dateStr} · ${timeStr} Uhr</div>
      <div class="tod-label">${escapeHtml(timeCtx.label)}</div>
      <div class="tod-sub">${escapeHtml(timeCtx.sub)}</div>
      <div class="mode-chip">
        <div class="mode-icon">${cfg.icon}</div>
        <div class="mode-text">${modeName}</div>
      </div>
      <div class="hero">
        <div class="hero-number">${mins}</div>
        <div class="hero-unit">${({"de":"Minute","en":"Minute","es":"Minuto","zh":"分钟","fr":"Minute","pt":"Minuto","ja":"分","ko":"분","it":"Minuto","ru":"Минута","hi":"मिनट","tr":"Dakika","nl":"Minuut","pl":"Minuta","sv":"Minut","he":"דקה"})[lang]||(mins===1?"Minute":"Minuten")}</div>
      </div>
      <div class="user-line">${userLine}</div>
      <div class="quote">„${quoteText}“</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">${{"de":"Dauer","en":"Duration","es":"Duración","zh":"时长","fr":"Durée","pt":"Duração","ja":"時間","ko":"시간","it":"Durata","ru":"Длит.","hi":"अवधि","tr":"Süre","nl":"Duur","pl":"Czas","sv":"Varaktighet","he":"משך"}[lang]||"Duration"}</div>
          <div class="stat-value">${mins}</div>
          <div class="stat-sub">min</div>
        </div>
        <div class="stat">
          <div class="stat-label">${{"de":"Zeit","en":"Time","es":"Hora","zh":"时间","fr":"Heure","pt":"Hora","ja":"時刻","ko":"시간","it":"Ora","ru":"Время","hi":"समय","tr":"Saat","nl":"Tijd","pl":"Czas","sv":"Tid","he":"שעה"}[lang]||"Time"}</div>
          <div class="stat-value">${timeStr}</div>
          <div class="stat-sub">${({"de":"heute","en":"today","es":"hoy","zh":"今天","fr":"aujourd'hui","pt":"hoje","ja":"今日","ko":"오늘","it":"oggi","ru":"сегодня","hi":"आज","tr":"bugün","nl":"vandaag","pl":"dzisiaj","sv":"idag","he":"היום"})[lang]||"heute"}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${{"de":"Modus","en":"Mode","es":"Modo","zh":"模式","fr":"Mode","pt":"Modo","ja":"モード","ko":"모드","it":"Modalità","ru":"Режим","hi":"मोड","tr":"Mod","nl":"Modus","pl":"Tryb","sv":"Läge","he":"מצב"}[lang]||"Mode"}</div>
          <div class="stat-value" style="font-size: 56px;">${cfg.icon}</div>
          <div class="stat-sub">${modeName}</div>
        </div>
      </div>
      ${streakTx ? `<div class="streak">🔥 ${escapeHtml(streakTx)}</div>` : ""}
      <div class="footer">
        <div class="footer-left">
          <div class="footer-title">${escapeHtml(cfg.cta)}</div>
          <div class="footer-url">${escapeHtml(cfg.ctaUrl)}</div>
        </div>
        <div class="footer-right">
          <div class="footer-stores">
            <div class="footer-store-badge">
              <span class="footer-store-icon" style="font-size:11px;font-weight:600;letter-spacing:-0.5px">App</span>
              <span class="footer-store-label">App Store</span>
            </div>
            <div class="footer-store-badge">
              <span class="footer-store-icon">▶</span>
              <span class="footer-store-label">Play Store</span>
            </div>
          </div>
          <div class="footer-social">
            <span class="footer-social-handle">📸 @stillmind.app</span>
            <span class="footer-social-handle">🎵 @stillmind.app</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function shareSessionCard(opts = {}) {
  const lang = getLanguage() || "de";
  const {
    modeId,
    durationMinutes,
    timestamp,
    sessionTitle,
    quote,
    logoBase64,
    customHtml,
  } = opts;

  try {
    let html = customHtml;
    if (!html) {
      const [userName, history] = await Promise.all([
        getUserName().catch(() => null),
        getSessionHistory().catch(() => []),
      ]);
      const streak = await getDailyStreak(history).catch(() => 0);
      html = buildShareCardHtml({
        modeId,
        durationMinutes,
        timestamp: timestamp || Date.now(),
        sessionTitle,
        quote,
        userName,
        streak,
        logoUri: logoBase64 || null,
      });
    }

    const printPromise = Print.printToFileAsync({
      html,
      base64: false,
      width: 1080,
      height: 1920,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("print timeout")), 15000)
    );
    const { uri } = await Promise.race([printPromise, timeoutPromise]);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      const cfg = resolveMode(modeId, lang);
      const mins = Math.max(1, Number(durationMinutes) || 1);
      await Share.share({
        title: "StillMind – Session abgeschlossen",
        message: `${cfg.icon} StillMind – ${sessionTitle || cfg.label}\n\n${mins} ${({"de":"Minute","en":"Minute","es":"Minuto","zh":"分钟","fr":"Minute","pt":"Minuto","ja":"分","ko":"분","it":"Minuto","ru":"Минута","hi":"मिनट","tr":"Dakika","nl":"Minuut","pl":"Minuta","sv":"Minut","he":"דקה"})[lang]||(mins===1?"Minute":"Minuten")} Ruhe.\n\n${quote || cfg.subline}\n\n📱 App Store: https://apps.apple.com/app/id6758213061\n▶ Play Store: https://play.google.com/store/apps/details?id=de.stillmind.app`,
      });
      return "shared";
    }

    // Share image + store links as text together
    const storeText = "📱 StillMind – kostenlos herunterladen:\n🍎 App Store: https://apps.apple.com/app/id6758213061\n▶ Play Store: https://play.google.com/store/apps/details?id=de.stillmind.app\n📸 @stillmind.app";

    // iOS: Share.share supports url + message together (image + text in one sheet)
    // Android: fallback to Sharing.shareAsync (image only, text separate)
    if (Platform.OS === "ios") {
      await Share.share({
        url: uri,
        message: storeText,
        title: "StillMind Session",
      });
    } else {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Card teilen",
        UTI: "com.adobe.pdf",
      });
    }

    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return "shared";
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("cancel") || message.includes("dismiss")) {
      return "cancelled";
    }
    console.error("[shareSessionCard]", error);
    return "error";
  }
}

export function getCardPreviewData(modeId, durationMinutes, timestamp, sessionTitle) {
  const lang = getLanguage() || "de";
  const cfg = resolveMode(modeId, lang);
  const timeCtx = getTimeContext(timestamp, lang);
  const mins = Math.max(1, Number(durationMinutes) || 1);
  return {
    color: cfg.color,
    soft: cfg.soft,
    border: cfg.border,
    background: cfg.gradient,
    icon: cfg.icon,
    label: cfg.label,
    title: sessionTitle || cfg.label,
    timeLabel: timeCtx.label,
    timeSub: timeCtx.sub,
    mins,
  };
}

export { resolveMode, buildShareCardHtml };
