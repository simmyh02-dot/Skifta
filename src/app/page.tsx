import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { StatsBand } from "@/components/landing/StatsBand";
import { Pricing } from "@/components/landing/Pricing";
import { CtaBand } from "@/components/landing/CtaBand";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <StatsBand />
        <Pricing />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
