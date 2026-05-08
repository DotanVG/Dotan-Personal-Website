import { Nav } from "@/components/clean/Nav";
import { Hero } from "@/components/clean/Hero";
import { About } from "@/components/clean/About";
import { ExperienceTimeline } from "@/components/clean/ExperienceTimeline";
import { EducationTimeline } from "@/components/clean/EducationTimeline";
import { Contact } from "@/components/clean/Contact";
import { Footer } from "@/components/clean/Footer";
import { ModeRouter } from "@/components/mode/ModeRouter";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { Cursor } from "@/components/ui/Cursor";

export default function Page() {
  return (
    <>
      <ScrollProgress />
      <Cursor />
      <ModeRouter
        cleanContent={
          <>
            <Nav />
            <main>
              <Hero />
              <About />
              <ExperienceTimeline />
              <EducationTimeline />
              <Contact />
            </main>
            <Footer />
          </>
        }
      />
    </>
  );
}
