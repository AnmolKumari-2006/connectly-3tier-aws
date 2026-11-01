import { useRef, useState } from "react";
import { Image as ImageIcon, Video, Smile, MapPin, X, Globe2, Users, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocialData } from "../../context/SocialDataContext";
import { useCreatePostModal } from "../../context/CreatePostModalContext";
import { mediaUrl } from "../../api/client";
import Avatar from "../ui/Avatar";
import Modal from "../ui/Modal";
import { EmojiPanel, EmojiToggle } from "../ui/EmojiPicker";
import { insertAtCursor } from "../../utils/emoji";
import { cn } from "../../utils/cn";

const FEELINGS = ["😊 happy", "🥳 celebrating", "😌 relaxed", "😍 loved", "😴 tired", "🚀 motivated"];
const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: Globe2 },
  { value: "friends", label: "Friends Only", icon: Users },
  { value: "only_me", label: "Only Me", icon: Lock },
];

export default function CreatePostModal() {
  const { open, closeModal, notifyCreated } = useCreatePostModal();
  const { user } = useAuth();
  const { createPost } = useSocialData();

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // real File objects, sent to the API
  const [previews, setPreviews] = useState([]); // local object URLs, for display only
  // Starts from the user's "Default post visibility" setting.
  // null means "not chosen yet", so a changed setting applies immediately.
  const defaultPrivacy = user?.settings?.defaultPostPrivacy || "friends";
  const [privacyChoice, setPrivacy] = useState(null);
  const privacy = privacyChoice ?? defaultPrivacy;
  const [feeling, setFeeling] = useState(null);
  const [feelingPickerOpen, setFeelingPickerOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [locationInputOpen, setLocationInputOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  if (!user) return null;

  const reset = () => {
    setText("");
    setFiles([]);
    setPreviews([]);
    setPrivacy(null);
    setFeeling(null);
    setFeelingPickerOpen(false);
    setLocation("");
    setLocationInputOpen(false);
    setEmojiOpen(false);
  };

  const close = () => {
    closeModal();
    reset();
  };

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).slice(0, 4 - files.length);
    setFiles((list) => [...list, ...newFiles].slice(0, 4));
    setPreviews((list) => [...list, ...newFiles.map((f) => URL.createObjectURL(f))].slice(0, 4));
  };

  const insertEmoji = (emoji) => {
    const { value, caret } = insertAtCursor(textareaRef.current, text, emoji);
    setText(value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const removeFile = (index) => {
    setFiles((list) => list.filter((_, i) => i !== index));
    setPreviews((list) => list.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!text.trim() && files.length === 0) return;
    setSubmitting(true);
    try {
      // Feeling and location are saved in their own database columns.
      const post = await createPost({ text: text.trim(), privacy, files, feeling: feeling || "", location: location.trim() });
      notifyCreated(post);
      close();
    } catch {
      // error toast already shown by SocialDataContext
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = (text.trim().length > 0 || files.length > 0) && !submitting;

  return (
    <Modal open={open} onClose={close} title="Create post">
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={mediaUrl(user.avatar)} alt={user.fullName} size="sm" />
        <div>
          <p className="text-sm font-semibold text-ink dark:text-ink-inverted">{user.fullName}</p>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            className="text-xs font-medium bg-surface-light dark:bg-white/5 rounded-full pl-2.5 pr-6 py-1 border border-border dark:border-border-dark text-ink dark:text-ink-inverted appearance-none cursor-pointer"
          >
            {PRIVACY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={`What's on your mind, ${user.fullName.split(" ")[0]}?`}
        className="w-full resize-none border-none bg-transparent text-[15px] text-ink dark:text-ink-inverted placeholder:text-ink-muted focus:outline-none"
      />

      {(feeling || location) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {feeling && <Chip onRemove={() => setFeeling(null)}>feeling {feeling}</Chip>}
          {location && (
            <Chip onRemove={() => setLocation("")}>
              <MapPin size={12} className="inline mr-1" />
              {location}
            </Chip>
          )}
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {previews.map((src, i) => (
            <div key={src} className="relative rounded-xl overflow-hidden aspect-video">
              {files[i]?.type.startsWith("video/") ? (
                <video src={src} className="w-full h-full object-cover" muted />
              ) : (
                <img src={src} alt="" className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/60 text-white flex items-center justify-center"
                aria-label="Remove media"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {locationInputOpen && !location && (
        <input
          autoFocus
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setLocationInputOpen(false)}
          onBlur={() => setLocationInputOpen(false)}
          placeholder="Add a location…"
          className="input mb-3"
        />
      )}

      {feelingPickerOpen && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FEELINGS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFeeling(f);
                setFeelingPickerOpen(false);
              }}
              className="px-2.5 py-1 rounded-full text-xs bg-surface-light dark:bg-white/5 hover:bg-accent/10 hover:text-accent transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <EmojiPanel open={emojiOpen} onSelect={insertEmoji} />

      <div className="flex items-center justify-between border border-border dark:border-border-dark rounded-xl p-2 mb-4">
        <span className="text-xs font-medium text-ink-muted pl-1.5">Add to your post</span>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="icon-btn !w-8 !h-8 text-emerald-500"
            aria-label="Add photo"
            disabled={files.length >= 4}
          >
            <ImageIcon size={17} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="icon-btn !w-8 !h-8 text-red-500"
            aria-label="Add video"
            disabled={files.length >= 4}
          >
            <Video size={17} />
          </button>
          <button
            onClick={() => setFeelingPickerOpen((v) => !v)}
            className={cn("icon-btn !w-8 !h-8 text-amber-500", feelingPickerOpen && "bg-amber-500/10")}
            aria-label="Add feeling"
          >
            <Smile size={17} />
          </button>
          <button
            onClick={() => setLocationInputOpen((v) => !v)}
            className={cn("icon-btn !w-8 !h-8 text-accent", locationInputOpen && "bg-accent/10")}
            aria-label="Add location"
          >
            <MapPin size={17} />
          </button>
          <EmojiToggle open={emojiOpen} onClick={() => setEmojiOpen((v) => !v)} className="!w-8 !h-8" />
        </div>
      </div>

      <button onClick={submit} disabled={!canPost} className="btn-primary w-full">
        {submitting ? <Loader2 size={17} className="animate-spin" /> : "Publish"}
      </button>
    </Modal>
  );
}

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
      {children}
      <button onClick={onRemove} aria-label="Remove">
        <X size={12} />
      </button>
    </span>
  );
}
