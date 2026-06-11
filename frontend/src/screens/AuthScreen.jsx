import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const path = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        tab === "login"
          ? { email: form.email, password: form.password }
          : { username: form.username, email: form.email, password: form.password };

      const data = await apiFetch(path, "POST", body);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => e.key === "Enter" && submit();

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">chat<span>.</span>app</div>
        <div className="auth-sub">
          {tab === "login" ? "Welcome back" : "Create your account"}
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>
            Sign in
          </button>
          <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
            Register
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {tab === "register" && (
          <div className="field">
            <label>Username</label>
            <input value={form.username} onChange={set("username")} onKeyDown={onKey} placeholder="john_doe" autoFocus />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input value={form.email} onChange={set("email")} onKeyDown={onKey} placeholder="you@example.com" type="email" autoFocus={tab === "login"} />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={form.password} onChange={set("password")} onKeyDown={onKey} placeholder="••••••••" type="password" />
        </div>

        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );
}