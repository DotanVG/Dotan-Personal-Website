import { Nav } from "@/components/clean/Nav";
import { Hero } from "@/components/clean/Hero";
import { About } from "@/components/clean/About";
import { ExperienceTimeline } from "@/components/clean/ExperienceTimeline";
import { EducationTimeline } from "@/components/clean/EducationTimeline";
import { ProjectsTeaser } from "@/components/clean/ProjectsTeaser";
import { Contact } from "@/components/clean/Contact";
import { Footer } from "@/components/clean/Footer";
import { ModeRouter } from "@/components/mode/ModeRouter";

export default function Page() {
  return (
    <ModeRouter
      cleanContent={
        <>
          <Nav />
          <main>
            <Hero />
            <About />
            <ExperienceTimeline />
            <EducationTimeline />
            <ProjectsTeaser />
            <Contact />
          </main>
          <Footer />
        </>
      }
    />
  );
}
