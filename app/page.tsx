import Hero from "@/components/marketing/Hero";
import AIStudyHub from "@/components/marketing/sections/AIStudyHub";
import ResearchLab from "@/components/marketing/sections/ResearchLab";
import ResumeStudio from "@/components/marketing/sections/ResumeStudio";
import PlacementEngine from "@/components/marketing/sections/PlacementEngine";
import ProjectGenerator from "@/components/marketing/sections/ProjectGenerator";
import Pricing from "@/components/marketing/sections/Pricing";
import FAQ from "@/components/marketing/sections/FAQ";
import Footer from "@/components/marketing/sections/Footer";

export default function Home() {
  return (
    <main className="bg-[#050505]">
      <Hero />
      <AIStudyHub />
      <ResearchLab />
      <ResumeStudio />
      <PlacementEngine />
      <ProjectGenerator />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
