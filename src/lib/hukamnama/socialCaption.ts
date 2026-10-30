import { captionContent } from "./loadedContent";
import type { StudioState } from "./types";

export const DEFAULT_ARTICLE_URL = "";
export const DEFAULT_PDF_URL = "";
export const DEFAULT_HASHTAGS = "#hukamnama #dailyhukamnama #hukamnamasahib #darbarsahib #amritsar #gurbani #gurbanipage #harmandirsahib #sikh #sikhism #mukhwak #wmk #waheguru #gurugranthsahibji #wmkji #gurugobindsinghji #gurunanakdevji #Guru #goldentemple #trending #bhakti #motivation #satnamwaheguruੴ #guruji #waheguruji";

export function buildSocialCaption(
  state: Pick<StudioState, "dateText" | "original" | "translation" | "fullOriginal" | "fullTranslation">,
  articleUrl: string,
  pdfUrl: string,
  includeHashtags = true,
): string {
  const content = captionContent(state);
  return [
    "🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ 🪯",
    "🌸 ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ, ਸ਼੍ਰੀ ਦਰਬਾਰ ਸਾਹਿਬ, ਹਰਿਮੰਦਿਰ ਸਾਹਿਬ, ਅੰਮ੍ਰਿਤਸਰ 🌸",
    `🗓️ ${state.dateText}`,
    "----",
    `📜 *${content.original.trim()}* 📜`,
    "----",
    `🗒️ ${content.translation.trim()}`,
    ...(articleUrl.trim() || pdfUrl.trim() || includeHashtags ? ["----"] : []),
    ...(articleUrl.trim() ? ["📌 Read Complete Hukamnama Punjabi-English-Hindi Translation in detail:", `🔗 ${articleUrl.trim()}`, ""] : []),
    ...(pdfUrl.trim() ? ["📃 Download Hukamnama PDF", `🔗 ${pdfUrl.trim()}`] : []),
    ...(includeHashtags && (articleUrl.trim() || pdfUrl.trim()) ? ["----"] : []),
    ...(includeHashtags ? [DEFAULT_HASHTAGS] : []),
  ].join("\n");
}
