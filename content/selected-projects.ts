import type { Project } from "@/types";

type SelectedProject = Pick<Project, "title" | "description" | "tags"> & {
  role: string;
  url: string;
  sourceUrl: string;
};

export const selectedProjects: SelectedProject[] = [
  {
    title: "BeatEmPie",
    description:
      "A browser arcade beat 'em up where Shushki drops magical pies to fight waves of fish and whales.",
    role: "Programming, design & project management",
    tags: ["Phaser 4", "TypeScript", "Vite"],
    url: "https://beat-em-pie.vercel.app/",
    sourceUrl: "https://github.com/DotanVG/BeatEmPie-Phaser",
  },
  {
    title: "Orbital Breach",
    description:
      "A browser zero-gravity team shooter with rail launches, freeze pistols and enemy portals to breach.",
    role: "Development",
    tags: ["Three.js", "TypeScript", "Colyseus", "WebSocket"],
    url: "https://orbital-breach.vercel.app/",
    sourceUrl: "https://github.com/DotanVG/Orbital-Breach",
  },
  {
    title: "Count Dawn",
    description:
      "A reverse horde survival game where a vampire hunts the hunters and races back to his coffin before sunrise.",
    role: "Design, programming & game architecture",
    tags: ["Phaser 4", "TypeScript", "Vite"],
    url: "https://count-dawn.vercel.app/",
    sourceUrl: "https://github.com/DotanVG/Count-Dawn",
  },
  {
    title: "URL Metadata Fetcher",
    description:
      "A web tool for inspecting, auditing and exporting Open Graph, Twitter Card, JSON-LD and HTML metadata from public URLs.",
    role: "Full-stack development",
    tags: ["React", "Node.js", "Express", "Cheerio"],
    url: "https://react-node-url-mdata-fetch-dotanv.netlify.app/",
    sourceUrl: "https://github.com/DotanVG/react-node-url-metadata-fetcher",
  },
];
