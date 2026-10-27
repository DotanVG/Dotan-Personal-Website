import { selectedProjects } from "@/content/selected-projects";

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

      <div className="mt-12 divide-y divide-line border-y border-line">
        {selectedProjects.map((project) => (
          <article
            key={project.sourceUrl}
            className="grid gap-4 py-8 md:grid-cols-12 md:gap-8 md:py-10"
          >
            <h3 className="font-display text-2xl font-semibold tracking-tight md:col-span-4">
              {project.title}
            </h3>
            <div className="min-w-0 md:col-span-8">
              <p className="max-w-prose text-base leading-relaxed text-ink/80 md:text-lg">
                {project.description}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                {project.role} · {project.tags.join(" · ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a
                  href={project.url}
                  className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 hover:text-ink/70"
                >
                  {project.title === "URL Metadata Fetcher" ? "Try" : "Play"}{" "}
                  {project.title}
                </a>
                <a
                  href={project.sourceUrl}
                  className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink/70"
                >
                  {project.title} source on GitHub
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
