import { useEffect, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import Modal from "../ui/Modal";
import { usersApi, mediaUrl } from "../../api/client";
import { getAvatarFallback } from "../../utils/avatarFallback";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function EditProfileModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ fullName: "", bio: "", location: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm({ fullName: user.fullName, bio: user.bio || "", location: user.location || "" });
      setAvatarPreview(null);
      setCoverPreview(null);
      setAvatarFile(null);
      setCoverFile(null);
    }
  }, [open, user]);

  if (!user) return null;

  const handleImage = (kind) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "avatar") {
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      setCoverFile(file);
      setCoverPreview(url);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { user: updated } = await usersApi.updateProfile(form);
      updateUser(updated);

      if (avatarFile) {
        const { user: withAvatar } = await usersApi.uploadAvatar(avatarFile);
        updateUser(withAvatar);
      }
      if (coverFile) {
        const { user: withCover } = await usersApi.uploadCover(coverFile);
        updateUser(withCover);
      }

      showToast("Profile updated successfully.");
      onClose();
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <div className="relative rounded-xl2 overflow-hidden h-28 mb-10 bg-gradient-to-br from-primary to-accent">
        {(coverPreview || mediaUrl(user.cover)) && (
          <img
            src={coverPreview || mediaUrl(user.cover)}
            alt=""
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        <label className="absolute inset-0 flex items-center justify-center bg-ink/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
          <Camera className="text-white" size={22} />
          <input type="file" accept="image/*" hidden onChange={handleImage("cover")} />
        </label>
        <label className="absolute -bottom-8 left-5 w-20 h-20 rounded-full ring-4 ring-surface-card dark:ring-surface-dark-card cursor-pointer group">
          <img
            src={avatarPreview || mediaUrl(user.avatar) || getAvatarFallback(user.fullName)}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
          <span className="absolute inset-0 rounded-full bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="text-white" size={16} />
          </span>
          <input type="file" accept="image/*" hidden onChange={handleImage("avatar")} />
        </label>
      </div>

      <div className="space-y-3.5">
        <Field label="Full name">
          <input
            className="input"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </Field>
        <Field label="Bio">
          <textarea
            className="input resize-none"
            rows={3}
            maxLength={160}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
        </Field>
        <Field label="Location">
          <input
            className="input"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </Field>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full mt-5">
        {saving ? <Loader2 size={17} className="animate-spin" /> : "Save changes"}
      </button>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-muted mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
