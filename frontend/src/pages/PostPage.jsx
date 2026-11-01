import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileX2 } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import PostCard from "../components/post/PostCard";
import { SkeletonFeed } from "../components/ui/SkeletonLoader";
import { postsApi } from "../api/client";

/** A single post, opened from a shared link (/post/:id). */
export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ id: null, post: null, error: null });

  useEffect(() => {
    let cancelled = false;
    postsApi
      .get(id)
      .then((data) => !cancelled && setState({ id, post: data.post, error: null }))
      .catch((err) => !cancelled && setState({ id, post: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = state.id !== id;

  return (
    <div>
      <Topbar title="Post" subtitle="Shared on Connectly" />
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {loading ? (
        <SkeletonFeed count={1} />
      ) : state.post ? (
        <PostCard post={state.post} onDeleted={() => navigate("/")} />
      ) : (
        <div className="card flex flex-col items-center text-center py-16 px-6">
          <span className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
            <FileX2 size={24} />
          </span>
          <h3 className="font-display font-bold text-lg text-ink dark:text-ink-inverted">Post not available</h3>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">{state.error}</p>
          <Link to="/" className="btn-primary mt-5">
            Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}
