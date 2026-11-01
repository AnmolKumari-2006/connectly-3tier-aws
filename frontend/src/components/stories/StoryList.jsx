import { useCallback, useEffect, useState } from "react";
import { storiesApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Story from "./Story";
import AddStory from "./AddStory";
import CreateStoryModal from "./CreateStoryModal";
import StoryViewer from "./StoryViewer";

export default function StoryList() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);

  const load = useCallback(() => {
    return storiesApi
      .list()
      .then((data) => setGroups(data?.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Optimistically grey out a story once it's been watched.
  const markViewed = useCallback((storyId) => {
    setGroups((list) =>
      list.map((g) => {
        if (!g.stories.some((s) => s.id === storyId)) return g;
        const stories = g.stories.map((s) => (s.id === storyId ? { ...s, viewedByMe: true } : s));
        return { ...g, stories, allViewed: stories.every((s) => s.viewedByMe) };
      })
    );
  }, []);

  const removeStory = useCallback((storyId) => {
    setGroups((list) =>
      list
        .map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) }))
        .filter((g) => g.stories.length > 0)
    );
  }, []);

  const closeViewer = () => {
    setViewerIndex(null);
    load(); // re-sort so freshly watched stories move behind unseen ones
  };

  const handleCreated = async () => {
    setCreateOpen(false);
    await load();
  };

  if (!user) return null;

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-0.5 py-1 -mx-0.5">
        <AddStory onClick={() => setCreateOpen(true)} />
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                <span className="skeleton w-16 h-16 !rounded-full" />
                <span className="skeleton w-10 h-2.5" />
              </div>
            ))
          : groups.map((g, i) => <Story key={g.user.id} group={g} onOpen={() => setViewerIndex(i)} />)}
      </div>

      <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      {viewerIndex !== null && groups[viewerIndex] && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIndex}
          onClose={closeViewer}
          onViewed={markViewed}
          onDeleted={removeStory}
        />
      )}
    </>
  );
}
