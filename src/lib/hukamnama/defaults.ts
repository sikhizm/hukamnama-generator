import type { StudioState } from "./types";
import { formatHukamDate, todayISO } from "./punjabiDate";

export const DEFAULT_ORIGINAL =
  "📜 ਸਲੋਕੁ ਮਃ ੪ ॥ ਬਿਨੁ ਸਤਿਗੁਰ ਸੇਵੇ ਜੀਅ ਕੇ ਬੰਧਨਾ ਜੇਤੇ ਕਰਮ ਕਮਾਹਿ ॥ ਬਿਨੁ ਸਤਿਗੁਰ ਸੇਵੇ ਠਵਰ ਨ ਪਾਵਹੀ ਮਰਿ ਜੰਮਹਿ ਆਵਹਿ ਜਾਹਿ ॥ ਬਿਨੁ ਸਤਿਗੁਰ ਸੇਵੇ ਫਿਕਾ ਬੋਲਣਾ ਨਾਮੁ ਨ ਵਸੈ ਮਨਿ ਆਇ ॥ ਨਾਨਕ ਬਿਨੁ ਸਤਿਗੁਰ ਸੇਵੇ ਜਮ ਪੁਰਿ ਬਧੇ ਮਾਰੀਅਹਿ ਮੁਹਿ ਕਾਲੈ ਉਠਿ ਜਾਹਿ ॥੧॥ 📜";

export const DEFAULT_TRANSLATION =
  "🗒️ ਸਤਿਗੁਰੂ ਦੀ ਦੱਸੀ ਹੋਈ ਕਾਰ ਕਰਨ ਤੋਂ ਬਿਨਾ ਜਿਤਨੇ ਵੀ ਕੰਮ ਜੀਵ ਕਰਦੇ ਹਨ, ਉਹ ਸਾਰੇ ਹੀ ਉਹਨਾਂ ਲਈ ਬੰਧਨ ਬਣਦੇ ਹਨ। ਸਤਿਗੁਰੂ ਦੀ ਸੇਵਾ ਤੋਂ ਬਿਨਾ ਜੀਵ ਟਿਕਾਅ ਨਹੀਂ ਪਾ ਸਕਦਾ, ਮਰ-ਮਰ ਕੇ ਜੰਮਦਾ ਅਤੇ ਆਉਂਦਾ ਜਾਂਦਾ ਰਹਿੰਦਾ ਹੈ। ਸਤਿਗੁਰੂ ਦੀ ਸੇਵਾ ਤੋਂ ਬਿਨਾ ਬੋਲਣਾ ਫਿੱਕਾ ਜਾਪਦਾ ਹੈ, ਪ੍ਰਭੂ ਦਾ ਨਾਮ ਮਨ ਵਿਚ ਨਹੀਂ ਵੱਸਦਾ। ਹੇ ਨਾਨਕ! ਸਤਿਗੁਰੂ ਦੀ ਸੇਵਾ ਤੋਂ ਬਿਨਾ ਮਨੁੱਖ ਜਮਾਂ ਦੇ ਸ਼ਹਿਰ ਵਿੱਚ ਬੰਨ੍ਹੇ ਹੋਏ ਮਾਰ ਖਾਂਦੇ ਹਨ ਅਤੇ ਮੂੰਹ ਕਾਲਾ ਕਰਕੇ ਉੱਥੋਂ ਉੱਠ ਜਾਂਦੇ ਹਨ ॥੧॥";

export function defaultState(): StudioState {
  const iso = todayISO();
  return {
    presetId: "vertical",
    safeArea: false,
    bg: {
      mode: "image",
      dataUrl: null,
      solidColor: "#101c3f",
      gradFrom: "#101c3f",
      gradTo: "#0a0f22",
      gradAngle: 160,
      overlay: 0.22,
      gradTop: 0.34,
      gradBottom: 0.42,
      panelOpacity: 0.58,
      panelBlur: 10,
    },
    header: {
      align: "center",
      scale: 1,
      padding: 84,
    },
    dateISO: iso,
    dateManual: false,
    dateText: formatHukamDate(new Date()),
    banikar: "ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ",
    ang: "552",
    original: DEFAULT_ORIGINAL,
    translation: DEFAULT_TRANSLATION,
    typo: {
      justify: true,
      autoFit: true,
      manualSize: 40,
      lineHeight: 1.62,
    },
    footer: true,
    fontId: "chatrikuni",
    logo: {
      enabled: true,
      variant: "mark",
      position: "footer",
      scale: 1,
    },
  };
}
