export type SiteConfig = {
  name: string;
  fullName: string;
  roles: string[];
  tagline: string;
  bio: string[];
  location: string;
  email: string;
  phone: string;
  phoneIntl: string;
  whatsappE164: string;
  dob: string;
  social: {
    linkedin: string;
    github: string;
    itch: string;
    whatsapp: string;
  };
  services: {
    formspreeId: string;
    proveSourceApiKey: string;
    proveSourceVersion: string;
    gaId: string;
  };
  url: string;
};

export type Experience = {
  slug: string;
  role: string;
  company: string;
  companyUrl?: string;
  start: string;
  end: string;
  current?: boolean;
  logo: string;
  logoAspect?: number;
  bullets: string[];
  blurb?: string;
};

export type Education = {
  slug: string;
  degree: string;
  school: string;
  start: string;
  end: string;
  logo: string;
  logoAspect?: number;
  bullets: string[];
  blurb?: string;
};

export type Project = {
  slug: string;
  title: string;
  description: string;
  image?: string;
  url?: string;
  status: "live" | "in-progress" | "planned";
  tags: string[];
};

export type Mode = "clean" | "explore";
