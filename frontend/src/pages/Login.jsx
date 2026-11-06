import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import ConnectlyLogo from "../components/brand/ConnectlyLogo";
import ThemeToggle from "../components/ui/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/client";

export default function Login() {
  const [showPw, setShowPw] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when the account has two factor authentication on.
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  // Demo accounts come from the database (only shown when the server runs in demo mode).
  const [demo, setDemo] = useState({ enabled: false, accounts: [], password: null });
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    authApi
      .demoAccounts()
      .then((data) => setDemo({ enabled: !!data?.enabled, accounts: data?.accounts || [], password: data?.password }))
      .catch(() => {});
  }, []);

  const finish = () => navigate(location.state?.from?.pathname || "/", { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login({ identifier, password });
      if (result?.twoFactorRequired) {
        setChallenge(result.challenge);
        setCode("");
      } else {
        finish();
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyTwoFactor({ challenge, code });
      finish();
    } catch (err) {
      setError(err.message || "Something went wrong.");
      if (/expired/i.test(err.message || "")) setChallenge(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-light dark:bg-surface-dark">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-primary relative overflow-hidden p-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-center max-w-sm"
        >
          <div className="inline-flex mb-6">
            <span className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <ConnectlyLogo size="sm" withWordmark={false} />
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl text-white mb-3">Connectly</h1>
          <p className="text-white/75 text-[15px] leading-relaxed">
            Where your circle stays close. Share moments, catch up with friends,
            and see what's happening — all in one calm, uncluttered place.
          </p>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end">
          <div className="lg:hidden">
            <ConnectlyLogo size="sm" />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <h2 className="font-display font-extrabold text-2xl text-ink dark:text-ink-inverted mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-ink-muted mb-6">Log in to catch up with your circle. Evaluation CC.</p>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm">
                {error}
              </div>
            )}

            {challenge ? (
              <form onSubmit={submitCode} className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-accent/10 text-sm text-ink dark:text-ink-inverted">
                  <ShieldCheck size={20} className="text-accent shrink-0 mt-0.5" />
                  <p>Two factor authentication is on. Open your authenticator app and enter the 6 digit code for Connectly.</p>
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Authentication code</span>
                  <input
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="input text-center tracking-[0.5em] font-mono text-lg"
                  />
                </label>
                <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full !py-3">
                  {loading ? <Loader2 size={17} className="animate-spin" /> : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:hover:text-ink-inverted"
                >
                  <ArrowLeft size={15} /> Back to login
                </button>
              </form>
            ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">
                  Email or username
                </span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    className="input pl-10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    required
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                {loading ? <Loader2 size={17} className="animate-spin" /> : "Log In"}
              </button>
            </form>
            )}

            <p className="text-center text-sm text-ink-muted mt-6">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary dark:text-accent font-semibold hover:underline">
                Sign up
              </Link>
            </p>

            {demo.enabled && !challenge && (
              <div className="mt-6 px-3.5 py-2.5 rounded-xl bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark text-xs text-ink-muted">
                <p>
                  <strong className="text-ink dark:text-ink-inverted">Demo accounts</strong> (password{" "}
                  <code>{demo.password}</code>). Tap one to fill it in:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {demo.accounts.map((a) => (
                    <button
                      key={a.username}
                      type="button"
                      title={a.fullName}
                      onClick={() => {
                        setIdentifier(a.username);
                        setPassword(demo.password);
                        setError("");
                      }}
                      className={
                        "px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors " +
                        (identifier.trim().toLowerCase().replace(/^@+/, "") === a.username
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border dark:border-border-dark hover:border-accent hover:text-accent")
                      }
                    >
                      {a.username}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
