import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, AtSign, Mail, Lock, Loader2 } from "lucide-react";
import ConnectlyLogo from "../components/brand/ConnectlyLogo";
import ThemeToggle from "../components/ui/ThemeToggle";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setErrors(err.errors || [err.message]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-light dark:bg-surface-dark">
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
            Create your profile, follow your friends, and share what's on your
            mind — Connectly is where your circle stays close.
          </p>
        </motion.div>
      </div>

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
              Create your account
            </h2>
            <p className="text-sm text-ink-muted mb-6">It only takes a minute.</p>

            {errors.length > 0 && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm space-y-1">
                {errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Full name</span>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input required value={form.fullName} onChange={update("fullName")} className="input pl-10" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Username</span>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    required
                    pattern="[a-zA-Z0-9_.]{3,30}"
                    value={form.username}
                    onChange={update("username")}
                    className="input pl-10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Email</span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input required type="email" value={form.email} onChange={update("email")} className="input pl-10" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={form.password}
                    onChange={update("password")}
                    className="input pl-10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-muted mb-1.5 block">Confirm password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    className="input pl-10"
                  />
                </div>
              </label>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                {loading ? <Loader2 size={17} className="animate-spin" /> : "Sign Up"}
              </button>
            </form>

            <p className="text-center text-sm text-ink-muted mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary dark:text-accent font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
