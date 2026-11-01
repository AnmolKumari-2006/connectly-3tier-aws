import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserCheck, Clock, Loader2 } from "lucide-react";
import { friendsApi } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { cn } from "../../utils/cn";

/**
 * A single button whose label/action adapts to friendship status.
 * Fully controlled: the parent owns `status` (from whatever API response
 * listed this person) and receives the new status back via onStatusChange
 * once the backend confirms it, so every list stays in sync with the
 * database rather than a locally-guessed state.
 */
export default function FriendActionButton({ userId, status, onStatusChange, size = "sm", className }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const run = async (action, successStatus, successMessage) => {
    setLoading(true);
    try {
      await action(userId);
      onStatusChange?.(successStatus);
      if (successMessage) showToast(successMessage);
    } catch (err) {
      showToast(err.message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  if (loading) {
    return (
      <button disabled className={cn("btn-outline", sizeClasses, className)}>
        <Loader2 size={14} className="animate-spin" />
        <span>Please wait</span>
      </button>
    );
  }

  if (status === "friends") {
    return (
      <button
        onClick={() => run(friendsApi.remove, "none", "Friend removed")}
        className={cn("btn-outline hover:!border-red-300 hover:!text-red-500", sizeClasses, className)}
      >
        <UserCheck size={14} />
        Friends
      </button>
    );
  }

  if (status === "request_sent") {
    return (
      <button
        onClick={() => run(friendsApi.cancel, "none")}
        className={cn("btn-outline", sizeClasses, className)}
      >
        <Clock size={14} />
        Cancel Request
      </button>
    );
  }

  if (status === "request_received") {
    return (
      <button
        onClick={() => run(friendsApi.accept, "friends", "Friend request accepted")}
        className={cn("btn-primary", sizeClasses, className)}
      >
        <UserCheck size={14} />
        Accept Request
      </button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => run(friendsApi.send, "request_sent", "Friend request sent")}
      className={cn("btn-primary", sizeClasses, className)}
    >
      <UserPlus size={14} />
      Add Friend
    </motion.button>
  );
}
