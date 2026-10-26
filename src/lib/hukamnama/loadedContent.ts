import { hukamnamaExcerpt } from "./excerpt";
import type { LiveHukamnama } from "./liveSource";
import type { StudioState } from "./types";

/** Editable fields show the media excerpt; untouched source remains available to captions and verification. */
export function loadedContent(record: LiveHukamnama) {
  const excerpt = hukamnamaExcerpt(record.original, record.translation);
  return excerpt.error
    ? { original: record.original, translation: record.translation, fullOriginal: undefined, fullTranslation: undefined }
    : { original: excerpt.original, translation: excerpt.translation, fullOriginal: record.original, fullTranslation: record.translation };
}

export function captionContent<T extends Pick<StudioState, "original" | "translation" | "fullOriginal" | "fullTranslation">>(state: T) {
  return { ...state, original: state.fullOriginal ?? state.original, translation: state.fullTranslation ?? state.translation };
}
