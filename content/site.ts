import type { SiteConfig } from "@/types";

// Bump only when the visible portfolio content changes significantly.
export const lastContentChange = "2026-10-27";

export const site: SiteConfig = {
  name: "Dotan",
  fullName: "Dotan Veretzky",
  roles: [
    "Software Engineer",
    "Game Dev Enthusiast",
    "Electronics Practical Engineer",
    "Always building, always learning.",
  ],
  tagline: "Software Engineer & Indie Game Developer",
  bio: [
    "I am passionate about software. A full-stack developer with a deep grounding in computers and electronics, plus rich experience across low-voltage systems, networks, communications and tutoring.",
    "I am a quick learner and a team player who gets things done. I adapt easily to new environments and challenges and care about building software that feels effortless to use.",
  ],
  location: "Israel",
  email: "dotanvg@gmail.com",
  phone: "+972-54-779-2350",
  phoneIntl: "+972547792350",
  whatsappE164: "972547792350",
  dob: "1994-09-08",
  social: {
    linkedin: "https://www.linkedin.com/in/dotan-v/",
    github: "https://github.com/DotanVG",
    itch: "https://dotanv.itch.io/",
    whatsapp: "https://api.whatsapp.com/send?phone=972547792350",
  },
  services: {
    formspreeId: "xqknykyd",
    proveSourceApiKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOiI2MmNhZDNlMWMyOGRjYjYzZDY0ZDEyYjMiLCJpYXQiOjE2NTc0NTk2ODF9.ANrAwRNxOGnHpka90mJ7jybFpTVFgv248OOxUoZDpYA", // gitleaks:allow (public client-side ProveSource key, already shipped in the browser bundle)
    proveSourceVersion: "0.0.4",
    gaId: "G-EFHW18YHGH",
  },
  url: "https://dotanv.vercel.app",
};

export const profileJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${site.url}/#person`,
      name: site.fullName,
      givenName: "Dotan",
      familyName: "Veretzky",
      email: `mailto:${site.email}`,
      telephone: site.phone,
      url: site.url,
      image: `${site.url}/images/avatar.jpg`,
      jobTitle: site.tagline,
      sameAs: [site.social.linkedin, site.social.github, site.social.itch],
    },
    {
      "@type": "ProfilePage",
      url: site.url,
      mainEntity: { "@id": `${site.url}/#person` },
      dateModified: lastContentChange,
    },
  ],
};
