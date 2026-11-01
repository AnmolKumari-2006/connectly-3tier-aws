// Gradient backgrounds for text-only stories. Keys must match
// STORY_BACKGROUNDS in backend/routes/stories.js. Full class strings are
// written out here so Tailwind's content scanner keeps them in the build.
export const STORY_BACKGROUNDS = {
  ocean: "from-accent to-primary",
  sunset: "from-orange-400 to-pink-600",
  forest: "from-emerald-400 to-teal-700",
  grape: "from-violet-500 to-fuchsia-600",
  night: "from-slate-700 to-slate-950",
  rose: "from-rose-400 to-red-600",
};

export const STORY_BACKGROUND_KEYS = Object.keys(STORY_BACKGROUNDS);

export function storyBackground(key) {
  return STORY_BACKGROUNDS[key] || STORY_BACKGROUNDS.ocean;
}
