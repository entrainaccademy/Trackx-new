"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, UserCheck, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import TeamMemberLoginForm from "@/components/auth/TeamMemberLoginForm";

export default function LoginPage() {
  const [loginTab, setLoginTab] = useState<"admin" | "team">("team");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium text-sm">Back to Home</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden sm:inline">Need an organization account?</span>
              <Link href="/signup">
                <Button variant="outline" size="sm" className="text-xs font-medium border-slate-200">
                  Sign Up Organization
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to TrackX</h1>
            <p className="text-sm text-slate-600">Select your login method to continue</p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-slate-200/70 p-1 rounded-xl flex space-x-1 max-w-md w-full shadow-inner">
              <button
                onClick={() => setLoginTab("team")}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  loginTab === "team"
                    ? "bg-white text-emerald-700 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Team Member Login</span>
              </button>
              <button
                onClick={() => setLoginTab("admin")}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  loginTab === "admin"
                    ? "bg-white text-indigo-700 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin / Org Login</span>
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          {loginTab === "team" ? (
            <TeamMemberLoginForm />
          ) : (
            <div className="w-full flex justify-center">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: "mx-auto w-full",
                    card: "shadow-xl border border-slate-200/80 rounded-2xl",
                    formFieldInput: "focus:ring-primary",
                  },
                }}
                routing="path"
                path="/login"
                signUpUrl="/signup"
                afterSignInUrl="/auth-redirect"
                redirectUrl="/auth-redirect"
                forceRedirectUrl="/auth-redirect"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 px-4 py-4 mt-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 max-w-6xl mx-auto">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <span>TrackX CRM</span>
            <span>•</span>
            <span>Admin-Controlled Password System</span>
          </div>
          <div className="flex items-center space-x-4">
            <a href="mailto:support@thetrackx.com" className="hover:text-slate-700">Help</a>
            <span>•</span>
            <Link href="/#pricing" className="hover:text-slate-700">Terms</Link>
            <span>•</span>
            <Link href="/#pricing" className="hover:text-slate-700">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
