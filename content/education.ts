import type { Education } from "@/types";

export const education: Education[] = [
  {
    slug: "nitzanim",
    degree: "DevOps Engineering & Cloud Infrastructure",
    school: "Nitzanim Program",
    start: "2024",
    end: "2024",
    logo: "/images/education/nitzanim.png",
    blurb:
      "1,000-hour intensive DevOps program by Nitzanim, held at John Bryce in Tel Aviv.",
    bullets: [
      "Continuous Integration / Continuous Deployment (CI/CD).",
      "Infrastructure as Code (IaC).",
      "Monitoring and logging.",
      "Deployment automation strategies.",
      "Application performance management.",
    ],
    exploreBuilding: "academy",
    position: [-22, 0],
  },
  {
    slug: "hackeru",
    degree: "Full-Stack Development",
    school: "HackerU Pro",
    start: "2022",
    end: "2022",
    logo: "/images/education/HackerU.jpg",
    blurb: "Intensive “No-Stack to Full-Stack” course covering modern web technologies.",
    bullets: [
      "JavaScript, HTML5, CSS3, Bootstrap.",
      "React, Node.js, MongoDB.",
      "End-to-end project work and deployment.",
    ],
    exploreBuilding: "glassCube",
    position: [-16, -14],
  },
  {
    slug: "ort",
    degree: "Electronics & Computers Practical Engineer",
    school: "ORT College, Rehovot",
    start: "2012",
    end: "2014",
    logo: "/images/education/ORT.jpg",
    blurb: "IDF “Eden” Project alumnus. Graduated with honors.",
    bullets: [
      "Majoring in computers and communications systems.",
      "Graduated with honors.",
      "IDF “Eden” Project alumnus.",
    ],
    exploreBuilding: "brickBlock",
    position: [0, -22],
  },
  {
    slug: "naval",
    degree: "Naval Officers School of Acre",
    school: "Military boarding school, Acre",
    start: "2009",
    end: "2012",
    logo: "/images/education/NavalOfficersSchool.jpg",
    blurb:
      "Class of 2012. Graduated with full Matriculation (Bagrut) and a Technological Bagrut.",
    bullets: [
      "Full Matriculation (Bagrut) Certificate.",
      "Technological Bagrut majoring in computers and electronics.",
      "Three-year boarding school experience focused on discipline, leadership, and STEM.",
    ],
    exploreBuilding: "lighthouse",
    position: [16, -14],
  },
];
