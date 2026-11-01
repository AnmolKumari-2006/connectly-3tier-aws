import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Type, Loader2, RefreshCw, X } from "lucide-react";
import { storiesApi } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import Modal from "../ui/Modal";
import { cn } from "../../utils/cn";
import { STORY_BACKGROUNDS, STORY_BACKGROUND_KEYS } from "../../utils/storyBackgrounds";

const MAX_TEXT = 300;
const MAX_FILE_MB = 40;

export default function CreateStoryModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState("media"); // "media" | "text"
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [background, setBackground] = useState("ocean");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Free the object URL when the preview changes or the modal unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const reset = () => {
    setMode("media");
    setFile(null);
    setPreview(null);
    setText("");
    setBackground("ocean");
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const pickFile = (picked) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/") && !picked.type.startsWith("video/")) {
      showToast("Please choose a photo or video.", "warning");
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      showToast(`File is too large (max ${MAX_FILE_MB} MB).`, "warning");
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const isVideo = file?.type.startsWith("video/");
  const canShare =
    !submitting && text.length <= MAX_TEXT && (mode === "media" ? !!file : text.trim().length > 0);

  const submit = async () => {
    if (!canShare) return;
    setSubmitting(true);
    try {
      await storiesApi.create({
        file: mode === "media" ? file : null,
        text: text.trim(),
        background,
      });
      showToast("Your story is live for 24 hours", "success");
      reset();
      onCreated?.();
    } catch (err) {
      showToast(err.message || "Couldn't share your story.", "warning");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Create story" maxWidth="max-w-md">
      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-surface-light dark:bg-white/5">
        {[
          { value: "media", label: "Photo / Video", icon: ImageIcon },
          { value: "text", label: "Text", icon: Type },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
              mode === value
                ? "bg-surface-card dark:bg-surface-dark-card text-ink dark:text-ink-inverted shadow-soft"
                : "text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        data-testid="story-file-input"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* 9:16 preview */}
      <div className="mx-auto w-full max-w-[250px] aspect-[9/16] rounded-xl2 overflow-hidden relative bg-surface-light dark:bg-white/5 mb-4">
        {mode === "media" ? (
          file ? (
            <>
              {isVideo ? (
                <video src={preview} className="absolute inset-0 w-full h-full object-contain bg-black" autoPlay muted loop playsInline />
              ) : (
                <>
                  <img src={preview} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60" />
                  <img src={preview} alt="Story preview" className="absolute inset-0 w-full h-full object-contain" />
                </>
              )}
              {text.trim() && (
                <p className="absolute bottom-4 inset-x-3 text-center text-white text-sm font-medium bg-black/45 rounded-lg px-3 py-2 break-words">
                  {text}
                </p>
              )}
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center"
                  aria-label="Change media"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center"
                  aria-label="Remove media"
                >
                  <X size={15} />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-muted hover:text-accent transition-colors border-2 border-dashed border-border dark:border-border-dark rounded-xl2"
            >
              <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                <ImageIcon size={26} />
              </span>
              <span className="text-sm font-medium">Choose a photo or video</span>
              <span className="text-xs">Up to {MAX_FILE_MB} MB</span>
            </button>
          )
        ) : (
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br flex items-center justify-center p-5",
              STORY_BACKGROUNDS[background]
            )}
          >
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              placeholder="Start typing…"
              rows={6}
              className="w-full bg-transparent border-none resize-none text-center text-white text-lg font-display font-bold placeholder:text-white/60 focus:outline-none"
            />
          </div>
        )}
      </div>

      {mode === "text" ? (
        <div className="flex items-center justify-center gap-2 mb-4">
          {STORY_BACKGROUND_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setBackground(key)}
              aria-label={`${key} background`}
              className={cn(
                "w-8 h-8 rounded-full bg-gradient-to-br transition-transform",
                STORY_BACKGROUNDS[key],
                background === key ? "ring-2 ring-offset-2 ring-accent ring-offset-surface-card dark:ring-offset-surface-dark-card scale-110" : "hover:scale-105"
              )}
            />
          ))}
        </div>
      ) : (
        file && (
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            placeholder="Add a caption (optional)"
            className="input mb-4"
          />
        )
      )}

      {text.length > MAX_TEXT - 50 && (
        <p className="text-xs text-ink-muted text-right -mt-2 mb-3">
          {text.length}/{MAX_TEXT}
        </p>
      )}

      <button onClick={submit} disabled={!canShare} className="btn-primary w-full">
        {submitting ? <Loader2 size={17} className="animate-spin" /> : "Share to story"}
      </button>
    </Modal>
  );
}
