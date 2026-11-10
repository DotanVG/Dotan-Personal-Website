import Image from "next/image";
import { selectedProjects } from "@/content/selected-projects";
import { selectedProjectImages } from "@/content/selected-project-images";

export function Projects() {
  return (
    <section
      id="projects"
      aria-labelledby="projects-heading"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <h2
        id="projects-heading"
        className="font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl"
      >
        Selected projects
      </h2>

      <ul className="mt-12 grid auto-rows-fr grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
        {selectedProjects.map((project, index) => {
          const image = selectedProjectImages[project.url];
          return (
            <li key={project.sourceUrl} className="min-w-0">
              <article className="h-full">
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="project-card flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-canvas-raised/60 backdrop-blur-md"
                >
                  <div className="relative aspect-video overflow-hidden bg-canvas-inset">
                    {image ? (
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 768px) 45vw, 92vw"
                        className="object-cover"
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-br from-canvas-inset via-accent-glow/30 to-ink/15 dark:from-canvas-raised dark:via-accent-glow/25 dark:to-ink/30"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
                    <h3 className="font-display text-2xl font-semibold tracking-tight text-balance">
                      {project.title}
                    </h3>
                    <p className="text-pretty text-base leading-relaxed text-ink/80 md:text-lg">
                      {project.description}
                    </p>
                  </div>
                </a>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
