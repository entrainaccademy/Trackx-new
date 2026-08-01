"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff, LogIn, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TeamMemberLoginForm() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTeamMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both Login ID / Email and Password");
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with backend database API
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      const user = data.user;
      toast.success(`Welcome back, ${user.name || "Team Member"}!`);

      // 2. Set session storage and cookies for client side context
      try {
        document.cookie = `trackx_user_email=${encodeURIComponent(user.email)}; path=/; max-age=86400`;
        document.cookie = `trackx_user_role=${encodeURIComponent(user.role || 'sales')}; path=/; max-age=86400`;
        localStorage.setItem("trackx_user_email", user.email);
        localStorage.setItem("trackx_user_name", user.name || "");
        localStorage.setItem("trackx_user_role", user.role || "sales");
        localStorage.setItem("trackx_user_code", user.code || user.email);
      } catch (e) {
        console.warn("Storage warning:", e);
      }

      // 3. Try Clerk sign-in to populate Clerk session if available
      if (isLoaded && signIn) {
        try {
          const clerkResult = await signIn.create({
            identifier: email.trim(),
            password: password,
          });

          if (clerkResult.status === "complete") {
            await setActive({ session: clerkResult.createdSessionId });
          }
        } catch (clerkErr: any) {
          console.warn("Clerk sign-in notice:", clerkErr?.errors?.[0]?.message || clerkErr?.message);
        }
      }

      // 4. Determine redirect path based on role
      const role = (user.role || "").toLowerCase();
      let targetPath = "/team-member";
      if (role === "jl" || role === "juniorleader") {
        targetPath = "/junior-leader";
      } else if (role === "teamleader" || role === "ceo" || role === "admin") {
        targetPath = "/team-leader/team-management";
      } else {
        // Regular team member / sales executive -> Team Member Separate Page
        targetPath = "/team-member";
      }

      router.push(targetPath);
    } catch (err: any) {
      console.error("Team member login error:", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl border border-slate-200/80 shadow-xl max-w-md w-full mx-auto transition-all duration-300">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <LogIn className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Team Member Login</h2>
        <p className="text-xs text-slate-500 mt-1">Sign in with credentials provided by your Administrator</p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs animate-shake">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleTeamMemberLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Login ID / Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@company.com"
              className="pl-9 h-11 border-slate-200 focus:ring-2 focus:ring-emerald-500 text-sm"
              autoComplete="username"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pl-9 pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-emerald-500 text-sm"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title={showPassword ? "Hide Password" : "Show Password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md transition-all duration-200 mt-2"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Authenticating...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>Sign In to Dashboard</span>
              <LogIn className="w-4 h-4" />
            </div>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400">
          Forgot your password? Contact your Super Admin or Company Admin to reset it.
        </p>
      </div>
    </div>
  );
}
