import type { StudioState } from "./types";

export const DEFAULT_ARTICLE_URL = "";
export const DEFAULT_PDF_URL = "";
export const DEFAULT_HASHTAGS = "#hukamnama #dailyhukamnama #hukamnamasahib #darbarsahib #amritsar #gurbani #gurbanipage #harmandirsahib #sikh #sikhism #mukhwak #wmk #waheguru #gurugranthsahibji #wmkji #gurugobindsinghji #gurunanakdevji #Guru #goldentemple #trending #bhakti #motivation #satnamwaheguruੴ #guruji #waheguruji";

export function buildSocialCaption(
  state: Pick<StudioState, "dateText" | "original" | "translation">,
  articleUrl: string,
  pdfUrl: string,
): string {
  return [
    "🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ 🪯",
    "🌸 ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ, ਸ਼੍ਰੀ ਦਰਬਾਰ ਸਾਹਿਬ, ਹਰਿਮੰਦਿਰ ਸਾਹਿਬ, ਅੰਮ੍ਰਿਤਸਰ 🌸",
    `🗓️ ${state.dateText}`,
    "----",
    `📜 *${state.original.trim()}* 📜`,
    "----",
    `🗒️ ${state.translation.trim()}`,
    "----",
    ...(articleUrl.trim() ? ["📌 Read Complete Hukamnama Punjabi-English-Hindi Translation in detail:", `🔗 ${articleUrl.trim()}`, ""] : []),
    ...(pdfUrl.trim() ? ["📃 Download Hukamnama PDF", `🔗 ${pdfUrl.trim()}`] : []),
    ...(articleUrl.trim() || pdfUrl.trim() ? ["----"] : []),
    DEFAULT_HASHTAGS,
  ].join("\n");
}
