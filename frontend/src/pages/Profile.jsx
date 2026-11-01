import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CalendarDays, Pencil, MessageCircle, Camera, Mail } from "lucide-react";
import { usersApi, postsApi, friendsApi, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/ui/Avatar";
import PostComposer from "../components/post/PostComposer";
import PostCard from "../components/post/PostCard";
import FriendActionButton from "../components/users/FriendActionButton";
import EditProfileModal from "../components/users/EditProfileModal";
import { useToast } from "../context/ToastContext";
import { SkeletonFeed } from "../components/ui/SkeletonLoader";
import { cn } from "../utils/cn";
import { parseServerDate } from "../utils/formatTime";

const TABS = ["Posts", "Media", "Friends"];

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { showToast } = useToast();
  const [profileData, setProfileData] = useState(null); // { user, status, mutual, isPrivateStranger }
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("Posts");
  const [editOpen, setEditOpen] = useState(false);
  const [posts, setPosts] = useState(null);
  const [friendsList, setFriendsList] = useState(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setProfileData(null);
    setNotFound(false);
    setPosts(null);
    setFriendsList(null);
    setTab("Posts");

    usersApi
      .getProfile(username)
      .then((data) => setProfileData(data))
      .catch(() => setNotFound(true));
  }, [username]);

  useEffect(() => {
    if (!profileData || profileData.isPrivateStranger) return;
    postsApi.byUser(profileData.user.id).then((d) => setPosts(d.posts));
    friendsApi
      .listOf(profileData.user.id)
      .then((d) => setFriendsList(d.friends))
      .catch(() => setFriendsList([]));
  }, [profileData]);

  if (notFound) {
    return (
      <div className="card text-center py-16 px-6">
        <h2 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">User not found</h2>
        <p className="text-sm text-ink-muted mt-1">@{username} doesn't exist on Connectly.</p>
      </div>
    );
  }

  if (!profileData) {
    return <SkeletonFeed count={2} />;
  }

  const { user: profileUser, status, mutual, isPrivateStranger } = profileData;
  const isSelf = status === "self";
  const mediaPosts = (posts || []).filter((p) => p.images?.length);

  const handleQuickAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { user: updated } = await usersApi.uploadAvatar(file);
      updateUser(updated);
      setProfileData((d) => ({ ...d, user: { ...d.user, avatar: updated.avatar } }));
      showToast("Profile photo updated");
    } catch (err) {
      showToast(err.message, "warning");
    }
  };

  return (
    <div>
      <div className="card overflow-hidden mb-5">
        <div className="h-40 sm:h-56 bg-gradient-to-br from-primary to-accent relative">
          {mediaUrl(profileUser.cover) && (
            <img src={mediaUrl(profileUser.cover)} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-4 -mt-12 sm:-mt-14">
            <div className="relative">
              <Avatar
                src={mediaUrl(profileUser.avatar)}
                alt={profileUser.fullName}
                size="2xl"
                ring
                className="ring-4 !ring-surface-card dark:!ring-surface-dark-card"
              />
              {isSelf && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="Change profile picture"
                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition shadow-soft-hover"
                  >
                    <Camera size={15} />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleQuickAvatarUpload}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2 pb-1">
              {isSelf ? (
                <button onClick={() => setEditOpen(true)} className="btn-outline">
                  <Pencil size={15} /> Edit Profile
                </button>
              ) : (
                <>
                  <FriendActionButton
                    userId={profileUser.id}
                    status={status}
                    onStatusChange={(newStatus) =>
                      setProfileData((d) => ({ ...d, status: newStatus }))
                    }
                    size="md"
                  />
                  {status === "friends" ? (
                    <button
                      onClick={() => navigate("/messages", { state: { openUserId: profileUser.id } })}
                      className="btn-outline"
                    >
                      <MessageCircle size={15} /> Message
                    </button>
                  ) : (
                    <button
                      onClick={() => showToast("You can message each other once you're friends.", "info")}
                      className="btn-outline opacity-60"
                    >
                      <MessageCircle size={15} /> Message
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="font-display font-extrabold text-xl text-ink dark:text-ink-inverted">
              {profileUser.fullName}
            </h1>
            <p className="text-sm text-ink-muted">@{profileUser.username}</p>
            {profileUser.bio && (
              <p className="text-sm text-ink dark:text-ink-inverted mt-2 max-w-xl">{profileUser.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-ink-muted">
              {profileUser.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {profileUser.location}
                </span>
              )}
              {profileUser.email && (
                <a href={`mailto:${profileUser.email}`} className="flex items-center gap-1 hover:text-primary dark:hover:text-accent">
                  <Mail size={13} /> {profileUser.email}
                </a>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays size={13} /> Joined{" "}
                {parseServerDate(profileUser.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {mutual !== undefined && !isSelf && (
                <span>{mutual} mutual friend{mutual === 1 ? "" : "s"}</span>
              )}
            </div>

            <div className="flex items-center gap-5 mt-4">
              <Stat label="Posts" value={profileUser.stats?.posts ?? 0} />
              <Stat label="Friends" value={profileUser.stats?.friends ?? 0} />
            </div>
          </div>
        </div>
      </div>

      {isSelf && (
        <div className="mb-5">
          <PostComposer onCreated={(post) => setPosts((list) => [post, ...(list || [])])} />
        </div>
      )}

      {isPrivateStranger ? (
        <div className="card empty-state text-center py-14 px-6">
          <MapPin className="mx-auto mb-2 text-accent" size={28} />
          <h3 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">
            This account is private
          </h3>
          <p className="text-sm text-ink-muted mt-1">
            Add {profileUser.fullName} as a friend to see their posts and friends list.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-5 border-b border-border dark:border-border-dark">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2.5 text-sm font-semibold relative -mb-px",
                  tab === t
                    ? "text-primary dark:text-accent"
                    : "text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
                )}
              >
                {t}
                {tab === t && (
                  <motion.span
                    layoutId="profile-tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary dark:bg-accent rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2 }}
            >
              {tab === "Posts" &&
                (posts === null ? (
                  <SkeletonFeed count={2} />
                ) : posts.length === 0 ? (
                  <EmptyTab message="No posts yet." />
                ) : (
                  <div className="space-y-4">
                    {posts.map((p) => (
                      <PostCard
                        key={p.id}
                        post={p}
                        onDeleted={(id) => setPosts((list) => list.filter((post) => post.id !== id))}
                      />
                    ))}
                  </div>
                ))}

              {tab === "Media" &&
                (posts === null ? (
                  <SkeletonFeed count={1} />
                ) : mediaPosts.length === 0 ? (
                  <EmptyTab message="No media yet." />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mediaPosts.flatMap((p) =>
                      p.images.map((src, i) => (
                        <div key={`${p.id}-${i}`} className="aspect-square rounded-xl2 overflow-hidden">
                          <img src={mediaUrl(src)} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))
                    )}
                  </div>
                ))}

              {tab === "Friends" &&
                (friendsList === null ? (
                  <SkeletonFeed count={1} />
                ) : friendsList.length === 0 ? (
                  <EmptyTab message="No friends yet." />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {friendsList.map((f) => (
                      <Link key={f.id} to={`/profile/${f.username}`} className="card card-hover p-3 flex items-center gap-3">
                        <Avatar src={mediaUrl(f.avatar)} alt={f.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink dark:text-ink-inverted truncate">{f.fullName}</p>
                          <p className="text-xs text-ink-muted truncate">@{f.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {isSelf && <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-sm">
      <span className="font-bold text-ink dark:text-ink-inverted">{value.toLocaleString()}</span>{" "}
      <span className="text-ink-muted">{label}</span>
    </div>
  );
}

function EmptyTab({ message }) {
  return (
    <div className="card text-center py-14 px-6">
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}
