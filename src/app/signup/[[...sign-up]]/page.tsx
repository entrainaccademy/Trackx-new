import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Home</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Already have an account?</span>
              <Link href="/login">
                <Button variant="ghost" className="text-primary hover:text-primary/90 font-medium">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your TrackX Account</h1>
            <p className="text-gray-600">Enter your information to get started</p>
          </div>

          <SignUp 
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-xl border-0",
                formFieldInput: "focus:ring-primary",
              },
            }}
            routing="path"
            path="/signup"
            signInUrl="/login"
            afterSignUpUrl="/onboarding"
            redirectUrl="/onboarding"
            forceRedirectUrl="/onboarding"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 max-w-6xl mx-auto">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span>English</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="#" className="hover:text-gray-700">Help</Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-700">Terms Of Service</Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-700">Privacy Policy</Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-700">Acceptable Use</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
