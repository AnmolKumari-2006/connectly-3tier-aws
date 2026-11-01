import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, Pause, Play, Trash2, X, Loader2 } from "lucide-react";
import { storiesApi, mediaUrl } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import Avatar from "../ui/Avatar";
import { cn } from "../../utils/cn";
import { formatRelativeTime } from "../../utils/formatTime";
import { storyBackground } from "../../utils/storyBackgrounds";

const PHOTO_DURATION = 5000; // ms a photo / text story stays on screen
const TICK = 50;

function firstUnseen(group) {
  const i = group.stories.findIndex((s) => !s.viewedByMe);
  return i === -1 ? 0 : i;
}

export default function StoryViewer({ groups, startIndex, onClose, onViewed, onDeleted }) {
  const { showToast } = useToast();
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(() => firstUnseen(groups[startIndex]));
  const [progress, setProgress] = useState(0); // 0..1 for the current story
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef(null);
  const pressStart = useRef(0);
  const elapsed = useRef(0); // ms shown so far for the current photo/text story

  const group = groups[gi];
  const story = group?.stories[si];
  const isVideo = story?.mediaType === "video";
  const isHalted = paused || viewersOpen || deleting;

  // ---- Navigation ------------------------------------------------------------
  // Progress is reset in the same update as the index change, so the
  // "progress hit 100% → next()" effect can never fire twice for one story.
  const go = useCallback((g, i) => {
    setGi(g);
    setSi(i);
    setProgress(0);
    setViewersOpen(false);
    setViewers(null);
    elapsed.current = 0;
  }, []);

  const next = useCallback(() => {
    if (!group) return;
    if (si < group.stories.length - 1) go(gi, si + 1);
    else if (gi < groups.length - 1) go(gi + 1, firstUnseen(groups[gi + 1]));
    else onClose();
  }, [group, groups, gi, si, go, onClose]);

  const prev = useCallback(() => {
    if (si > 0) go(gi, si - 1);
    else if (gi > 0) go(gi - 1, groups[gi - 1].stories.length - 1);
    else go(gi, si);
  }, [groups, gi, si, go]);

  // Mark other people's stories as seen.
  useEffect(() => {
    if (!story || group.isMine || story.viewedByMe) return;
    onViewed(story.id);
    storiesApi.view(story.id).catch(() => {});
  }, [story, group, onViewed]);

  // Always call the latest next() from the timer without restarting it.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // Timer for photos / text (videos drive progress from their own playback).
  // Pausing keeps the elapsed time, so resuming continues where it stopped.
  const storyId = story?.id;
  useEffect(() => {
    if (!storyId || isVideo || isHalted) return;
    const id = setInterval(() => {
      elapsed.current += TICK;
      const p = elapsed.current / PHOTO_DURATION;
      if (p >= 1) {
        clearInterval(id);
        nextRef.current();
      } else {
        setProgress(p);
      }
    }, TICK);
    return () => clearInterval(id);
  }, [storyId, isVideo, isHalted]);

  // Pause / resume video playback with the rest of the viewer.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isHalted) v.pause();
    else v.play().catch(() => {});
  }, [isHalted, storyId]);

  // Keyboard + body scroll lock.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [next, prev, onClose]);

  if (!group || !story) return null;

  // Hold to pause; a quick tap on the left third goes back, elsewhere forward.
  const onPointerDown = () => {
    pressStart.current = Date.now();
    setPaused(true);
  };
  const onPointerUp = (e) => {
    setPaused(false);
    if (Date.now() - pressStart.current > 250) return; // it was a hold, not a tap
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  const openViewers = async () => {
    setViewersOpen(true);
    try {
      const data = await storiesApi.viewers(story.id);
      setViewers(data.viewers || []);
    } catch {
      setViewers([]);
    }
  };

  const deleteStory = async () => {
    setDeleting(true);
    try {
      await storiesApi.remove(story.id);
      const wasLast = group.stories.length === 1;
      if (!wasLast) go(gi, si === group.stories.length - 1 ? si - 1 : si);
      onDeleted(story.id);
      showToast("Story deleted", "success");
      if (wasLast) onClose();
    } catch (err) {
      showToast(err.message || "Couldn't delete the story.", "warning");
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`${group.user.fullName}'s story`}>
      {/* Desktop arrows */}
      <button
        onClick={prev}
        className="hidden sm:flex absolute left-4 md:left-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center"
        aria-label="Previous story"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={next}
        className="hidden sm:flex absolute right-4 md:right-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center"
        aria-label="Next story"
      >
        <ChevronRight size={22} />
      </button>

      <div className="relative w-full h-full sm:h-[92vh] sm:w-auto sm:aspect-[9/16] sm:rounded-xl2 overflow-hidden bg-black select-none">
        {/* Content */}
        <div
          className="absolute inset-0"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setPaused(false)}
        >
          {story.mediaUrl ? (
            <>
              {isVideo ? (
                <video
                  key={story.id}
                  ref={videoRef}
                  src={mediaUrl(story.mediaUrl)}
                  className="absolute inset-0 w-full h-full object-contain"
                  autoPlay
                  playsInline
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setProgress(Math.min(0.999, v.currentTime / v.duration));
                  }}
                  onEnded={next}
                />
              ) : (
                <>
                  <img
                    src={mediaUrl(story.mediaUrl)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
                  />
                  <img
                    src={mediaUrl(story.mediaUrl)}
                    alt={story.text || "Story"}
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </>
              )}
              {story.text && (
                <p className="absolute bottom-20 inset-x-4 text-center text-white text-[15px] font-medium bg-black/45 rounded-lg px-3 py-2 break-words">
                  {story.text}
                </p>
              )}
            </>
          ) : (
            <div className={cn("absolute inset-0 bg-gradient-to-br flex items-center justify-center p-8", storyBackground(story.background))}>
              <p className="text-white text-center font-display font-bold text-2xl leading-snug break-words whitespace-pre-wrap">
                {story.text}
              </p>
            </div>
          )}
        </div>

        {/* Top: progress bars + header */}
        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <div className="flex gap-1 mb-3">
            {group.stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
                <span
                  className="block h-full bg-white"
                  style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <Avatar src={mediaUrl(group.user.avatar)} alt={group.user.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate">
                {group.isMine ? "Your story" : group.user.fullName}
              </p>
              <p className="text-white/70 text-xs">{formatRelativeTime(story.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={() => setPaused((p) => !p)}
                className="w-9 h-9 rounded-full text-white hover:bg-white/15 flex items-center justify-center"
                aria-label={paused ? "Play" : "Pause"}
              >
                {paused ? <Play size={18} /> : <Pause size={18} />}
              </button>
              {group.isMine && (
                <button
                  onClick={deleteStory}
                  disabled={deleting}
                  className="w-9 h-9 rounded-full text-white hover:bg-white/15 flex items-center justify-center"
                  aria-label="Delete story"
                >
                  {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full text-white hover:bg-white/15 flex items-center justify-center"
                aria-label="Close story"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: view count for your own stories */}
        {group.isMine && (
          <button
            onClick={openViewers}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white text-sm font-medium bg-black/40 hover:bg-black/60 rounded-full px-4 py-2"
          >
            <Eye size={16} />
            {story.viewCount ?? 0} {story.viewCount === 1 ? "view" : "views"}
          </button>
        )}

        {viewersOpen && (
          <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-surface-card dark:bg-surface-dark-card rounded-t-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
              <p className="font-semibold text-sm text-ink dark:text-ink-inverted">Viewed by</p>
              <button onClick={() => setViewersOpen(false)} className="icon-btn !w-8 !h-8" aria-label="Close viewers">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {viewers === null ? (
                <div className="flex justify-center py-6 text-ink-muted">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : viewers.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-6">No views yet.</p>
              ) : (
                viewers.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-2 py-2">
                    <Avatar src={mediaUrl(v.avatar)} alt={v.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink dark:text-ink-inverted truncate">{v.fullName}</p>
                      <p className="text-xs text-ink-muted">{formatRelativeTime(v.viewedAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
