import { useCallback, useEffect, useRef, useState } from "react";
import {
  User,
  Shield,
  Bell,
  Palette,
  Lock,
  Moon,
  Sun,
  Monitor,
  Loader2,
  ShieldCheck,
  Smartphone,
  LogOut,
} from "lucide-react";
import Topbar from "../components/layout/Topbar";
import Switch from "../components/ui/Switch";
import Avatar from "../components/ui/Avatar";
import { usersApi, authApi, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../utils/cn";
import { formatRelativeTime } from "../utils/formatTime";

const SECTIONS = [
  { key: "account", label: "Account", icon: User },
  { key: "privacy", label: "Privacy", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "security", label: "Security", icon: Lock },
];

export default function Settings() {
  const [active, setActive] = useState("account");

  return (
    <div>
      <Topbar title="Settings" subtitle="Manage your Connectly account" />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={cn(
              "shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors",
              active === s.key
                ? "bg-primary text-white"
                : "bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
            )}
          >
            <s.icon size={15} />
            {s.label}
          </button>
        ))}
      </div>

      {active === "account" && <AccountSection />}
      {active === "privacy" && <PrivacySection />}
      {active === "notifications" && <NotificationsSection />}
      {active === "appearance" && <AppearanceSection />}
      {active === "security" && <SecuritySection />}
    </div>
  );
}

function SettingsCard({ title, description, children }) {
  return (
    <div className="card p-5 mb-4">
      <h3 className="font-display font-bold text-base text-ink dark:text-ink-inverted">{title}</h3>
      {description && <p className="text-sm text-ink-muted mt-0.5 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Row({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0 border-border dark:border-border-dark">
      <div>
        <p className="text-sm font-medium text-ink dark:text-ink-inverted">{label}</p>
        {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function AccountSection() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [birthday, setBirthday] = useState(user.birthday || "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { user: updated } = await usersApi.uploadAvatar(file);
      updateUser(updated);
      showToast("Profile photo updated");
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { user: updated } = await usersApi.updateProfile({ fullName, bio, location, birthday });
      updateUser(updated);
      showToast("Account details saved");
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Account information" description="Update your basic profile details.">
      <div className="flex items-center gap-4 mb-5">
        <Avatar src={mediaUrl(user.avatar)} alt={user.fullName} size="lg" />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
        <button onClick={() => fileRef.current?.click()} className="btn-outline">
          Change photo
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Full name</span>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Email</span>
          <input className="input opacity-60" value={user.email} disabled title="Email changes aren't supported yet" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Bio</span>
          <textarea
            className="input resize-none"
            rows={2}
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Location</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Birthday</span>
          <input
            type="date"
            className="input"
            value={birthday}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <span className="text-xs text-ink-muted mt-1 block">Your friends see it in their Upcoming birthdays.</span>
        </label>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <Loader2 size={17} className="animate-spin" /> : "Save changes"}
      </button>
    </SettingsCard>
  );
}

function PrivacySection() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const settings = user.settings || {};
  const [accountVisibility, setAccountVisibility] = useState(user.accountVisibility);
  const [defaultPostPrivacy, setDefaultPostPrivacy] = useState(settings.defaultPostPrivacy || "friends");
  const [showActivity, setShowActivity] = useState(settings.showActivity ?? true);
  const [showEmail, setShowEmail] = useState(settings.showEmail ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { user: updated } = await usersApi.updatePrivacy({
        accountVisibility,
        defaultPostPrivacy,
        showActivity,
        showEmail,
      });
      updateUser(updated);
      showToast("Privacy settings saved");
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Privacy" description="Control who can see your profile and activity.">
      <p className="text-sm font-semibold text-ink dark:text-ink-inverted mb-2">Account visibility</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        {[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ].map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors",
              accountVisibility === o.value
                ? "border-primary dark:border-accent bg-primary/5 dark:bg-accent/10"
                : "border-border dark:border-border-dark"
            )}
          >
            <input
              type="radio"
              name="visibility"
              value={o.value}
              checked={accountVisibility === o.value}
              onChange={() => setAccountVisibility(o.value)}
              className="accent-primary"
            />
            <span className="text-sm font-medium text-ink dark:text-ink-inverted">{o.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-muted mb-5">
        Private accounts hide their posts and friends list from anyone who isn't a friend. The server enforces this.
      </p>

      <label className="block mb-1">
        <span className="text-sm font-semibold text-ink dark:text-ink-inverted mb-2 block">Default post visibility</span>
        <select
          className="input max-w-xs"
          value={defaultPostPrivacy}
          onChange={(e) => setDefaultPostPrivacy(e.target.value)}
        >
          <option value="public">Public</option>
          <option value="friends">Friends Only</option>
          <option value="only_me">Only Me</option>
        </select>
      </label>
      <p className="text-xs text-ink-muted mb-4">New posts start with this setting. You can still change it for each post.</p>

      <Row label="Show activity status" description="Let friends see when you're online">
        <Switch checked={showActivity} onChange={setShowActivity} label="Show activity status" />
      </Row>
      <Row label="Show email on profile" description="Visible only to friends">
        <Switch checked={showEmail} onChange={setShowEmail} label="Show email on profile" />
      </Row>

      <button onClick={save} disabled={saving} className="btn-primary mt-4">
        {saving ? <Loader2 size={17} className="animate-spin" /> : "Save privacy settings"}
      </button>
    </SettingsCard>
  );
}

function NotificationsSection() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const prefs = user.settings?.notifications || { likes: true, comments: true, friendRequests: true, messages: true };
  const [saving, setSaving] = useState(null);

  // Each switch saves immediately.
  const toggle = (key) => async (value) => {
    setSaving(key);
    try {
      const { user: updated } = await usersApi.updateNotificationSettings({ [key]: value });
      updateUser(updated);
      showToast(value ? "Notifications turned on" : "Notifications turned off");
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setSaving(null);
    }
  };

  const rows = [
    { key: "likes", label: "Likes", description: "When someone likes your post or comment" },
    { key: "comments", label: "Comments", description: "When someone comments on your post" },
    { key: "friendRequests", label: "Friend requests", description: "When someone sends or accepts a request" },
    { key: "messages", label: "Messages", description: "When a friend sends you a message" },
  ];

  return (
    <SettingsCard
      title="Notifications"
      description="Choose what creates a notification for you. Changes are saved right away."
    >
      {rows.map((r) => (
        <Row key={r.key} label={r.label} description={r.description}>
          <Switch
            checked={!!prefs[r.key]}
            onChange={toggle(r.key)}
            label={r.label}
            disabled={saving === r.key}
          />
        </Row>
      ))}
    </SettingsCard>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <SettingsCard title="Appearance" description="Choose how Connectly looks on this device.">
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setTheme(o.key)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl2 border-2 transition-colors",
              theme === o.key
                ? "border-primary dark:border-accent bg-primary/5 dark:bg-accent/10"
                : "border-border dark:border-border-dark"
            )}
          >
            <o.icon
              size={22}
              className={theme === o.key ? "text-primary dark:text-accent" : "text-ink-muted"}
            />
            <span
              className={cn(
                "text-sm font-medium",
                theme === o.key ? "text-primary dark:text-accent" : "text-ink dark:text-ink-inverted"
              )}
            >
              {o.label}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-4 flex items-center gap-1.5">
        <Monitor size={13} /> Your preference is saved on this device only.
      </p>
    </SettingsCard>
  );
}

function SecuritySection() {
  return (
    <>
      <PasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </>
  );
}

function PasswordCard() {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setSaving(true);
    try {
      const { signedOutSessions } = await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(
        signedOutSessions > 0
          ? `Password updated. ${signedOutSessions} other device${signedOutSessions === 1 ? " was" : "s were"} signed out.`
          : "Password updated"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title="Change password" description="Other devices are signed out when you change it.">
      <form onSubmit={save}>
        {error && <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm">{error}</div>}
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Current password</span>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted mb-1.5 block">New password</span>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Confirm new password</span>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={17} className="animate-spin" /> : "Update password"}
        </button>
      </form>
    </SettingsCard>
  );
}

function TwoFactorCard() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const enabled = !!user.settings?.twoFactorEnabled;
  const [setup, setSetup] = useState(null); // { qrCode, secret } while enabling
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setTwoFactor = (value) =>
    updateUser({ settings: { ...(user.settings || {}), twoFactorEnabled: value } });

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      setSetup(await authApi.setupTwoFactor());
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.enableTwoFactor(code);
      setTwoFactor(true);
      setSetup(null);
      showToast("Two factor authentication is on");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.disableTwoFactor(password);
      setTwoFactor(false);
      setDisabling(false);
      setPassword("");
      showToast("Two factor authentication is off", "info");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Two factor authentication"
      description="Ask for a 6 digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) when logging in."
    >
      {error && <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm">{error}</div>}

      {enabled && !disabling && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={18} /> On. Your account asks for a code at every login.
          </p>
          <button onClick={() => setDisabling(true)} className="btn-outline !py-1.5 !px-3 !text-xs">
            Turn off
          </button>
        </div>
      )}

      {enabled && disabling && (
        <form onSubmit={turnOff} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Confirm with your password</span>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 size={17} className="animate-spin" /> : "Turn off"}
          </button>
          <button type="button" onClick={() => setDisabling(false)} className="btn-outline">
            Cancel
          </button>
        </form>
      )}

      {!enabled && !setup && (
        <button onClick={start} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={17} className="animate-spin" /> : "Set up two factor authentication"}
        </button>
      )}

      {!enabled && setup && (
        <form onSubmit={confirm} className="grid sm:grid-cols-[auto,1fr] gap-5 items-start">
          <img
            src={setup.qrCode}
            alt="QR code for your authenticator app"
            className="w-44 h-44 rounded-xl bg-white p-2 border border-border"
          />
          <div className="space-y-3">
            <p className="text-sm text-ink dark:text-ink-inverted">
              1. Scan this QR code with your authenticator app.
              <br />
              2. Enter the 6 digit code it shows to finish.
            </p>
            <p className="text-xs text-ink-muted">
              Can't scan? Enter this key in the app instead:
              <code className="block mt-1 font-mono text-[11px] break-all text-ink dark:text-ink-inverted">{setup.secret}</code>
            </p>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              aria-label="Authentication code"
              className="input max-w-[180px] text-center tracking-[0.4em] font-mono"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length !== 6} className="btn-primary">
                {busy ? <Loader2 size={17} className="animate-spin" /> : "Turn on"}
              </button>
              <button type="button" onClick={() => setSetup(null)} className="btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}

function SessionsCard() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    authApi
      .sessions()
      .then((data) => setSessions(data?.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const endOne = async (id) => {
    try {
      await authApi.endSession(id);
      setSessions((list) => list.filter((s) => s.id !== id));
      showToast("Device signed out", "info");
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  const endOthers = async () => {
    setBusy(true);
    try {
      const { signedOutSessions } = await authApi.logoutOthers();
      showToast(
        signedOutSessions > 0 ? `Signed out ${signedOutSessions} other device${signedOutSessions === 1 ? "" : "s"}` : "No other devices were signed in",
        "info"
      );
      load();
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setBusy(false);
    }
  };

  const others = (sessions || []).filter((s) => !s.current).length;

  return (
    <SettingsCard
      title="Active sessions"
      description={
        sessions === null
          ? "Loading devices…"
          : `${sessions.length} device${sessions.length === 1 ? "" : "s"} currently signed in to your account.`
      }
    >
      <ul className="divide-y divide-border dark:divide-border-dark mb-4">
        {(sessions || []).map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Smartphone size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink dark:text-ink-inverted">
                {s.device}
                {s.current && <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">This device</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {s.ip ? `${s.ip} · ` : ""}Active {formatRelativeTime(s.lastUsedAt)}
              </p>
            </div>
            {!s.current && (
              <button onClick={() => endOne(s.id)} className="icon-btn !w-8 !h-8" aria-label={`Sign out ${s.device}`}>
                <LogOut size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button onClick={endOthers} disabled={busy || others === 0} className="btn-outline !py-1.5 !px-3 !text-xs">
        {busy ? <Loader2 size={14} className="animate-spin" /> : "Sign out all other devices"}
      </button>
    </SettingsCard>
  );
}
