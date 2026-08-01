"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Globe,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ShieldCheck,
  Rocket,
  Users,
  Workflow,
  LayoutDashboard,
  Settings,
  PhoneCall,
  Webhook,
  Fingerprint,
  PlayCircle,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// -----------------------------
// DYNAMIC IMPORT FOR TENANT HOMEPAGE
// -----------------------------
const TenantHomepage = dynamic(() => import("./tenant-homepage"), {
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Loading tenant workspace...</p>
      </div>
    </div>
  ),
  ssr: false,
});

// -----------------------------
// OPTIONAL: USE TENANT HOOK (stub)
// Replace with your real implementation that reads subdomain from hostname or middleware
// -----------------------------
function useTenant() {
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const hostname = window.location.hostname.toLowerCase();
      
    // If IPv4 or localhost → treat as main domain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
      setSubdomain(null);
      setLoading(false);
        return;
      }
      
    // *.localhost during dev
      if (hostname.endsWith(".localhost")) {
        const left = hostname.slice(0, -".localhost".length);
        const label = left.split(".")[0];
      setSubdomain(label || null);
      setLoading(false);
        return;
      }
      
    // Production domains: thetrackx.com, *.thetrackx.com
      const parts = hostname.split(".");
    const hasSub = parts.length > 2 && parts[0] !== "www";
    setSubdomain(hasSub ? parts[0] : null);
    setLoading(false);
  }, []);

  return { subdomain, loading };
}

// -----------------------------
// SIMPLE TENANT LOGO (placeholder) — replace with your real component if you have one
// -----------------------------
function TenantLogo({ name = "Tenant" }: { name?: string }) {
    return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg grid place-items-center">
        <span className="text-white text-sm font-bold">TX</span>
        </div>
      <span className="font-semibold text-slate-900">{name}</span>
      </div>
    );
  }

// -----------------------------
// ANIMATED DEMO CHART (SVG)
// -----------------------------
function AnimatedChart() {
  return (
    <Card className="w-full h-56 bg-white/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2 text-slate-700">
          <BarChart3 className="w-5 h-5" />
          <CardTitle className="text-sm font-medium">Lead Analytics</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs">Last 30 days</Badge>
      </CardHeader>
      <div className="relative h-36">
        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-2">
          {[18, 26, 20, 32, 28, 40, 36, 52, 46, 60, 72, 68].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-gradient-to-t from-indigo-200 to-indigo-500/80 rounded"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 100, damping: 18 }}
            />
          ))}
              </div>
        {/* Line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d="M0,70 C10,68 20,62 30,58 C40,55 50,50 60,44 C70,38 80,30 90,26 L100,22"
            fill="none"
            stroke="currentColor"
            className="text-indigo-700/80"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
        </svg>
      </div>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-500">New Leads</div>
            <div className="font-semibold text-slate-900">1,221</div>
          </div>
          <div>
            <div className="text-slate-500">CPL</div>
            <div className="font-semibold text-slate-900">₹4.85</div>
          </div>
          <div>
            <div className="text-slate-500">Conversions</div>
            <div className="font-semibold text-slate-900">312</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// ANIMATED APP SCREEN MOCK
// -----------------------------
function AppScreens() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2 text-slate-700">
              <LayoutDashboard className="w-5 h-5" />
              <CardTitle className="text-base">Pipeline Overview</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">Today</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["New", "Qualified", "Won"].map((col, i) => (
                <Card key={col} className="p-3">
                  <div className="text-xs text-slate-500">{col}</div>
                  <div className="text-2xl font-bold">{[56, 34, 18][i]}</div>
                  <div className="mt-2 h-1.5 rounded bg-slate-100">
                    <div className="h-1.5 rounded bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${[68, 42, 88][i]}%` }} />
                  </div>
                </Card>
              ))}
            </div>
            <AnimatedChart />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2 text-slate-700">
              <Workflow className="w-5 h-5" />
              <CardTitle className="text-base">Automations</CardTitle>
            </div>
            <Badge variant="success" className="text-xs">Active: 7</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-3">
              {[
                { t: "Round-robin Lead Assignment", i: CheckCircle2 },
                { t: "Auto WhatsApp on New Lead", i: Bot },
                { t: "SLA Breach Alerts", i: ShieldCheck },
                { t: "Webhook to LMS", i: Webhook },
              ].map(({ t, i: Icon }, idx) => (
                <li key={idx} className="flex items-center gap-3 p-3 rounded-xl border">
                  <Icon className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-700">{t}</span>
                  <Badge variant="outline" className="ml-auto text-xs">Running</Badge>
                </li>
              ))}
            </ul>
            <Card className="mt-4 bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <Rocket className="w-4 h-4" /> Boost conversions by 27% with Playbooks
                </div>
                <p className="text-sm text-slate-600 mt-1">Drag‑and‑drop sequences for calls, WhatsApp, and follow‑ups.</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </motion.div>
          </div>
  );
}

// -----------------------------
// NAVBAR
// -----------------------------
function Navbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg grid place-items-center">
              <span className="text-white font-bold text-lg">TX</span>
                </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">TrackX</h1>
              <p className="text-[10px] leading-none text-slate-500 -mt-0.5">Built for Institutes & Online Trainers</p>
              </div>
                  </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">Features</Link>
            <Link href="#solutions" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">Solutions</Link>
            <Link href="#pricing" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">Pricing</Link>
            <Link href="#faq" className="text-slate-700 hover:text-blue-600 font-medium transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup" className="flex items-center gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenMobile} className="md:hidden" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
              </div>
              </div>
    </header>
  );
}

// -----------------------------
// FOOTER
// -----------------------------
function Footer() {
  return (
    <footer className="bg-slate-950 text-white py-16 px-6 mt-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg grid place-items-center">
                <span className="text-white font-bold text-sm">TX</span>
                </div>
              <span className="text-xl font-bold">TrackX</span>
              </div>
            <p className="text-sm text-slate-400">The CRM built for lead‑heavy businesses — training institutes, academies, and modern sales teams.</p>
            </div>

          <div>
            <h3 className="font-semibold mb-4">Products</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="#features" className="hover:text-white transition-colors">Lead Management</Link></li>
              <li><Link href="#features" className="hover:text-white transition-colors">Automations</Link></li>
              <li><Link href="#features" className="hover:text-white transition-colors">Task & SLA</Link></li>
              <li><Link href="#features" className="hover:text-white transition-colors">Integrations</Link></li>
            </ul>
            </div>
            
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="#faq" className="hover:text-white transition-colors">Support</Link></li>
              <li><a href="mailto:support@thetrackx.com" className="hover:text-white transition-colors">Contact</a></li>
              <li><Link href="#pricing" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li><Link href="#pricing" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
                    </div>
              
                    <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><span>support@thetrackx.com</span></div>
              <div className="flex items-center gap-2"><Globe className="w-4 h-4" /><span>www.thetrackx.com</span></div>
                    </div>
                  </div>
            </div>
        <div className="border-t border-slate-800 pt-8 text-center">
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} All rights reserved. thetrackx</p>
          </div>
            </div>
    </footer>
  );
}

// -----------------------------
// MOBILE MENU (using shadcn Dialog)
// -----------------------------
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:hidden fixed inset-0 z-50 bg-white max-w-none w-full h-full rounded-none">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="sr-only">Mobile Navigation Menu</DialogTitle>
          <TenantLogo name="TrackX" />
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <nav className="p-6 space-y-4">
          {[
            ["Features", "#features"],
            ["Solutions", "#solutions"],
            ["Pricing", "#pricing"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <Link key={label} className="block text-lg font-medium text-slate-800" href={href} onClick={onClose}>
              {label}
            </Link>
          ))}
          <div className="pt-4 flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------
// HERO
// -----------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-200 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-200 rounded-full blur-3xl opacity-50"></div>

      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight"
            >
              Grow your Institute faster with <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">TrackX</span>
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-xl text-slate-600"
            >
              Convert more leads, automate follow‑ups, and see what’s working — all in one beautiful dashboard built for academies & online trainers.
            </motion.p>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <Button size="lg" asChild>
                <Link href="/signup" className="inline-flex items-center gap-2">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a 
                  href="https://wa.me/919633180779?text=Hi! I'd like to see a demo of TrackX CRM for my institute." 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" /> Watch Demo
                </a>
              </Button>
            </motion.div>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {["Leads", "Calls", "WhatsApp", "Tasks"].map((t) => (
                <Tooltip key={t}>
                  <TooltipTrigger asChild>
                    <Card className="p-3 text-center cursor-help">
                      <div className="text-2xl font-bold">{t === "Leads" ? "50k+" : t === "Calls" ? "1.2M" : t === "WhatsApp" ? "3.4M" : "24k"}</div>
                      <div className="text-slate-500">{t} tracked</div>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total {t.toLowerCase()} managed through TrackX platform</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
                    </div>
          <div className="relative">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <AppScreens />
            </motion.div>
                  </div>
                    </div>
                  </div>
        </section>
  );
}

// -----------------------------
// FEATURES
// -----------------------------
function Features() {
  const items = [
    {
      icon: PhoneCall,
      title: "Call & WhatsApp Timeline",
      desc: "Auto-log calls, recordings, and WhatsApp chats against every lead card.",
    },
    {
      icon: Workflow,
      title: "Automations & Playbooks",
      desc: "Round-robin, SLA escalations, and drip sequences to never miss a follow-up.",
    },
    {
      icon: ShieldCheck,
      title: "Secure & Compliant",
      desc: "AWS S3 storage, field-level permissions, and audit trails across modules.",
    },
    {
      icon: Settings,
      title: "Custom Fields & Views",
      desc: "Design your lead layout, lists, and filters exactly as your team works.",
    },
    {
      icon: Webhook,
      title: "Integrations",
      desc: "Gallabox, Exotel/Twilio, Meta Lead Ads, Google Sheets, and Webhooks.",
    },
    {
      icon: Users, // or BarChart3 / Trophy / Target icon depending on what you prefer
      title: "Sales Performance & Leaderboard",
      desc: "Track salesperson targets, monitor conversions, and gamify performance with leaderboards for better motivation and growth.",
    },
  ];
  

  return (
    <section id="features" className="py-20 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-slate-900">Everything you need to scale</h2>
          <p className="text-slate-600 mt-2">From first touch to closed won — TrackX has your entire journey covered.</p>
                    </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600/10 text-indigo-700 grid place-items-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg mb-2">{title}</CardTitle>
                  <p className="text-slate-600 text-sm leading-6">{desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
          </div>
        </section>
  );
}


// -----------------------------
// WHY CHOOSE TRACKX
// -----------------------------
function WhyChooseTrackX() {
  const benefits = [
    {
      icon: Rocket,
      title: "Boost Sales Performance",
      description: "Increase your team's productivity by 40% with streamlined workflows and automated follow-ups",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: BarChart3,
      title: "Hit Your Targets",
      description: "Track progress in real-time and get insights to consistently exceed your sales goals",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Foster better teamwork with shared dashboards, team leaderboards, and performance insights",
      gradient: "from-purple-500 to-pink-500"
    }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Why Choose TrackX?</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Join thousands of successful sales teams who trust TrackX to drive their growth
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div 
              key={index} 
              className="group text-center"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className={`inline-flex p-6 rounded-3xl bg-gradient-to-r ${benefit.gradient} text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <benefit.icon className="w-8 h-8" />
                  </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">{benefit.title}</h3>
              <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
            </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}

// -----------------------------
// PRICING
// -----------------------------
function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "₹0",
      period: "/forever",
      features: ["Up to 3 users", "1,000 leads", "Basic automations", "Community support"],
      cta: "Start Free",
    },
    {
      name: "Growth",
      price: "₹799",
      period: "/user/mo",
      features: ["Unlimited leads", "Advanced automations", "SLA & Playbooks", "Priority support"],
      highlighted: true,
      cta: "Start Trial",
    },
    {
      name: "Scale",
      price: "Let's talk",
      period: "",
      features: ["Custom limits", "SAML/SSO", "Dedicated success", "On‑prem/Hybrid"],
      cta: "Contact Sales",
    },
  ];

  return (
    <section id="pricing" className="py-20 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-slate-900">Fair, simple pricing</h2>
          <p className="text-slate-600 mt-2">Start free. Upgrade when you scale.</p>
            </div>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <Card key={t.name} className={`shadow-sm ${t.highlighted ? "ring-2 ring-indigo-600" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">{t.name}</CardTitle>
                {t.highlighted && (
                  <Badge>Popular</Badge>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-end gap-1 mb-4">
                  <div className="text-4xl font-extrabold">{t.price}</div>
                  <div className="text-slate-500">{t.period}</div>
                </div>
                <ul className="space-y-2 text-slate-600 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600" /> <span>{f}</span></li>
                  ))}
                </ul>
              </CardContent>
              {t.name === "Scale" ? (
                <Button asChild className="m-6 w-auto">
                  <a 
                    href="https://wa.me/919633180779?text=Hi! I'm interested in TrackX Scale plan for my business. Can we discuss pricing and features?" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {t.cta}
                  </a>
                </Button>
              ) : (
                <Button asChild className="m-6 w-auto">
                  <Link href="/signup">{t.cta}</Link>
                </Button>
              )}
            </Card>
          ))}
                </div>
                </div>
        </section>
  );
}

// -----------------------------
// FAQ
// -----------------------------
function FAQ() {
  const faqs = [
    {
      q: "Can I import leads from Excel/Sheets?",
      a: "Yes. You can bulk import leads via CSV or directly connect Google Sheets. New rows in Sheets can automatically sync into TrackX.",
    },
    {
      q: "Do you support WhatsApp & call recordings?",
      a: "Absolutely. Integrate Gallabox, Exotel, or Twilio to log WhatsApp chats and call recordings automatically. Mobile recordings can also be uploaded to S3 and attached to the lead timeline.",
    },
    {
      q: "Can I track salesperson targets and performance?",
      a: "Yes. TrackX lets you set individual sales targets, monitor conversions, and view performance in real-time dashboards. Leaderboards motivate your team by showing top performers.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. All data is encrypted in transit and at rest. TrackX uses AWS S3 storage, strict role-based permissions, and audit logs to ensure compliance and security.",
    },
  ];
  
  return (
    <section id="faq" className="py-20 px-6 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-14">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map(({ q, a }, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="mb-4">
              <Card>
                <AccordionTrigger className="px-6 py-4 text-left font-semibold text-slate-800 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 text-slate-600">
                  {a}
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// -----------------------------
// FINAL CTA
// -----------------------------
function FinalCTA() {
  return (
    <section className="py-20 px-6 bg-gradient-to-r from-indigo-600 to-violet-600">
      <div className="max-w-5xl mx-auto text-center text-white">
        <h2 className="text-4xl font-bold mb-4">Start converting today</h2>
        <p className="text-lg opacity-90">Bespoke CRM to capture, qualify, and close — with beautiful analytics your team will love.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" variant="secondary" asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <a 
              href="https://wa.me/919633180779?text=Hi! I'd like to discuss TrackX CRM pricing and features for my business." 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Talk to Sales
            </a>
          </Button>
        </div>
          </div>
        </section>
  );
}

// -----------------------------
// MAIN PAGE (MARKETING) WITH TENANT REDIRECT/RENDER LOGIC
// -----------------------------
export default function HomePage() {
  const router = useRouter();
  const { subdomain, loading } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);

  // If we have a subdomain, render the tenant homepage instead of the marketing site
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
              </div>
              </div>
    );
  }

  if (subdomain) {
    // OPTION A (render):
    return <TenantHomepage />;

    // OPTION B (redirect): uncomment to route to /tenant
    // router.replace(`/tenant`);
    // return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar onOpenMobile={() => setMobileOpen(true)} />
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="flex-1">
        <Hero />
        <Features />
        <WhyChooseTrackX />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
