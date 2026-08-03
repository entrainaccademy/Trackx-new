"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getTenantUrl } from "@/lib/tenantUrl";

interface OnboardingForm {
  companyName: string;
  subdomain: string;
  contactName: string;
  email: string;
  staffCount: string;
  industry: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const orgListResult = useOrganizationList({
    userMemberships: true,
  });
  
  // Extract organization list data - useOrganizationList returns { userMemberships, isLoaded }
  const orgList = orgListResult.userMemberships?.data || [];
  const isOrgListLoaded = orgListResult.isLoaded;
  const [form, setForm] = useState<OnboardingForm>({
    companyName: "",
    subdomain: "",
    contactName: "",
    email: "",
    staffCount: "",
    industry: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isCheckingExistingTenant, setIsCheckingExistingTenant] = useState(true);
  const hasCheckedTenant = useRef(false);

  // Check if user already has an organization and redirect them
  useEffect(() => {
    if (!isLoaded || hasCheckedTenant.current) return;

    const checkExistingTenant = async () => {
      if (!user) {
        // Not logged in, redirect to login
        hasCheckedTenant.current = true;
        router.push("/login");
        return;
      }

      // Wait for organization data to load
      if (!isOrgListLoaded) return;

      try {
        // First, check if user has a Clerk organization
        const activeOrg = organization || orgList?.[0]?.organization;
        
        if (activeOrg?.slug) {
          // User has an organization - redirect to organization subdomain
          const subdomain = activeOrg.slug;
          const redirectUrl = getTenantUrl(subdomain, '/team-leader');

          hasCheckedTenant.current = true;
          window.location.href = redirectUrl;
          return;
        }

        // Fallback: Check if user already has a tenant in database
        try {
          const response = await fetch("/api/users/current");
          const data = await response.json();

          if (data.success && data.user?.tenantId) {
            const tenantResponse = await fetch(`/api/tenants/by-id?tenantId=${data.user.tenantId}`);
            const tenantData = await tenantResponse.json();

            if (tenantData.success && tenantData.tenant?.subdomain) {
              const subdomain = tenantData.tenant.subdomain;
              const redirectUrl = getTenantUrl(subdomain, '/team-leader');

              hasCheckedTenant.current = true;
              window.location.href = redirectUrl;
              return;
            }
          }
        } catch (tenantError) {
          console.error("Error fetching tenant from database:", tenantError);
          // Continue to show onboarding form if tenant fetch fails
        }

        // Pre-fill form with Clerk user data
        const email = user.emailAddresses[0]?.emailAddress || "";
        const firstName = user.firstName || "";
        const lastName = user.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || email?.split("@")[0] || "";

        setForm(prev => ({
          ...prev,
          email: email,
          contactName: fullName,
        }));
      } catch (error) {
        console.error("Error checking existing tenant:", error);
      } finally {
        setIsCheckingExistingTenant(false);
      }
    };

    checkExistingTenant();
  }, [user, isLoaded, organization, isOrgLoaded, orgList, isOrgListLoaded, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: "error", text: "Logo file size must be less than 2MB" });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: "error", text: "Please select a valid image file" });
        return;
      }

      setLogoFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Clear any previous error messages
      setMessage(null);
    }
  };

  const validateSubdomain = (subdomain: string) => {
    return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSubdomain(form.subdomain)) {
      setMessage({ type: "error", text: "Subdomain must be 3-63 characters, lowercase letters, numbers, and hyphens only" });
      return;
    }

    const staffCountNum = parseInt(form.staffCount, 10);
    if (isNaN(staffCountNum) || staffCountNum <= 0) {
      setMessage({ type: "error", text: "Please enter a valid numeric Company Staff Count" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('subdomain', form.subdomain);
      formData.append('name', form.companyName);
      formData.append('metadata', JSON.stringify({
        contactName: form.contactName,
        email: form.email,
        staffCount: staffCountNum,
        industry: form.industry,
        onboardingDate: new Date().toISOString(),
      }));
      
      // Add logo file if selected
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const response = await fetch("/api/tenants", {
        method: "POST",
        body: formData, // Use FormData instead of JSON
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to organization subdomain (if available) or tenant subdomain
        const activeOrg = organization || orgList?.[0]?.organization;
        const subdomain = activeOrg?.slug || data.subdomain || form.subdomain;
        const redirectUrl = getTenantUrl(subdomain, '/team-leader');
        
        // Show success message briefly, then redirect
        setMessage({
          type: "success",
          text: `🎉 Welcome ${form.companyName}! Redirecting to your dashboard...`,
        });
        
        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create tenant" });
        setIsSubmitting(false);
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking existing tenant
  if (isCheckingExistingTenant || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect (handled in useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Welcome to Our CRM Platform
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get your own isolated CRM environment in minutes. Perfect for teams, agencies, and businesses.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Secure & Isolated</h3>
                  <p className="text-gray-600">Each client gets their own secure, isolated environment</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Instant Setup</h3>
                  <p className="text-gray-600">Get up and running in minutes, not days</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Full Analytics</h3>
                  <p className="text-gray-600">Complete CRM with leads, sales, and reporting</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Onboarding Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-3xl">Get Started</CardTitle>
              </CardHeader>
              <CardContent>
            
            <form onSubmit={handleSubmit} className="space-y-6 text-black">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <Input
                    type="text"
                    name="companyName"
                    value={form.companyName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter company name"
                  />
                </div>

                {/* Subdomain */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subdomain *
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      name="subdomain"
                      value={form.subdomain}
                      onChange={handleInputChange}
                      required
                      pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
                      className="pr-32"
                      placeholder="yourcompany"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 text-sm">
                      .wydex.co
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Only lowercase letters, numbers, and hyphens. 3-63 characters.
                  </p>
                </div>
              </div>

              {/* Company Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-16 h-16 object-contain border border-gray-300 rounded-lg bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      name="logo"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: 200x200px, PNG or JPG. Max 2MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Contact Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name *
                  </label>
                  <Input
                    type="text"
                    name="contactName"
                    value={form.contactName}
                    onChange={handleInputChange}
                    required
                    placeholder="Your full name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleInputChange}
                    required
                    placeholder="your@email.com"
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email is set from your Clerk account and cannot be changed
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Company Staff Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Staff Count *
                  </label>
                  <Input
                    type="number"
                    name="staffCount"
                    value={form.staffCount}
                    onChange={handleInputChange}
                    required
                    min={1}
                    placeholder="Enter staff count (e.g. 25)"
                  />
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry
                  </label>
                  <Input
                    type="text"
                    name="industry"
                    value={form.industry}
                    onChange={handleInputChange}
                    placeholder="e.g., Technology, Healthcare, Education"
                  />
                </div>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`p-4 rounded-lg ${
                  message.type === "success" 
                    ? "bg-green-100 text-green-800 border border-green-200" 
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}>
                  {message.text}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-lg"
              >
                {isSubmitting ? "Creating Your Environment..." : "Create My CRM Environment"}
              </Button>
            </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center mt-12 text-gray-600"
          >
            <p className="mb-2">
              Need help? Contact us at{" "}
              <a href="mailto:support@proskilledu.com" className="text-blue-600 hover:underline">
                support@proskilledu.com
              </a>
            </p>
            <p className="text-sm">
              Your data is secure and isolated. Each client environment is completely separate.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
