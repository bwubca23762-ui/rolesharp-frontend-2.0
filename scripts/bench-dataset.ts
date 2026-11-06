// 10 representative real-world resumes + matching job descriptions.
// Content modeled on real public resume samples (beamjobs/indeed/zety style
// bullets) and real job-posting language. Used to benchmark RoleSharp's tailor()
// engine: we score the ORIGINAL resume and the TAILORED output with the SAME
// atsScore() function for an apples-to-apples comparison.
export const DATASET = [
  {
    id: "1", role: "Software Engineer", level: "mid", company: "Stripe", roleTitle: "Software Engineer",
    profile: {
      name: "Candidate One", careerLevel: "mid", country: "United States", location: "San Francisco, CA",
      email: "c1@example.com", phone: "+1 202 555 0101",
      summary: "Software engineer with 5 years building web applications. Worked on backend services and APIs.",
      skills: ["JavaScript", "Python", "React", "Node.js", "SQL", "Git", "REST APIs", "AWS"],
      experiences: [
        { title: "Software Engineer", company: "TechCorp", start: "2021", end: "2024",
          bullets: ["Built features for the web app", "Worked with the backend team on APIs", "Fixed bugs and did code reviews", "Helped improve site performance"] },
        { title: "Junior Developer", company: "StartupXYZ", start: "2019", end: "2021",
          bullets: ["Developed frontend components in React", "Wrote unit tests", "Participated in agile sprints"] },
      ],
      education: [{ degree: "B.S. Computer Science", school: "State University", year: "2019" }],
      projects: [], certifications: [], languages: [],
    },
    jdText: "We are looking for a Software Engineer to join our payments infrastructure team. You will design, build, and maintain scalable backend services that process millions of transactions. Responsibilities include developing RESTful APIs, optimizing database queries, improving system reliability and latency, and collaborating with cross-functional teams. Requirements: 4+ years of experience with backend development, strong proficiency in Python or Go, experience with distributed systems, PostgreSQL, Redis, AWS, Docker, and Kubernetes. Experience with payment systems, idempotency, and high-availability architecture is a plus. You should care about clean code, testing, observability, and reducing latency at scale.",
  },
  {
    id: "2", role: "Data Analyst", level: "mid", company: "Microsoft", roleTitle: "Data Analyst",
    profile: {
      name: "Candidate Two", careerLevel: "mid", country: "United States", location: "Seattle, WA",
      email: "c2@example.com", phone: "+1 202 555 0102",
      summary: "Data analyst experienced in reporting and dashboards.",
      skills: ["Excel", "SQL", "Tableau", "Python", "data visualization", "reporting"],
      experiences: [
        { title: "Data Analyst", company: "RetailCo", start: "2020", end: "2024",
          bullets: ["Made dashboards for the sales team", "Pulled data using SQL queries", "Created weekly reports", "Analyzed customer trends"] },
      ],
      education: [{ degree: "B.A. Economics", school: "City College", year: "2020" }],
      projects: [], certifications: [], languages: [],
    },
    jdText: "Microsoft is seeking a Data Analyst to support business decisions with data. You will build dashboards in Power BI, write complex SQL queries against large datasets, perform statistical analysis, and present insights to stakeholders. Required skills: advanced SQL, Power BI or Tableau, Python or R for analysis, strong Excel, data modeling, and the ability to translate data into business recommendations. Experience with Azure, A/B testing, and KPI definition preferred. Strong communication skills and a data-driven mindset are essential.",
  },
  {
    id: "3", role: "Product Manager", level: "senior", company: "Google", roleTitle: "Senior Product Manager",
    profile: {
      name: "Candidate Three", careerLevel: "senior", country: "United States", location: "Mountain View, CA",
      email: "c3@example.com", phone: "+1 202 555 0103",
      summary: "Product manager with experience launching products.",
      skills: ["product management", "roadmap", "agile", "stakeholder management", "analytics"],
      experiences: [
        { title: "Product Manager", company: "SoftwareInc", start: "2018", end: "2024",
          bullets: ["Managed the product roadmap", "Worked with engineering and design", "Launched new features", "Talked to customers about requirements"] },
        { title: "Associate PM", company: "AppCo", start: "2016", end: "2018",
          bullets: ["Wrote product specs", "Ran user research", "Tracked metrics"] },
      ],
      education: [{ degree: "MBA", school: "Business School", year: "2016" }],
      projects: [], certifications: [], languages: [],
    },
    jdText: "Google is hiring a Senior Product Manager to lead a 0-to-1 product. You will define product strategy and vision, build and prioritize the roadmap, write detailed PRDs, partner with engineering, UX, and data science, and drive go-to-market. Requirements: 6+ years of product management, proven record shipping consumer or platform products, strong data fluency (SQL, experimentation, A/B testing), excellent stakeholder management and executive communication, and experience with OKRs and metrics-driven decision making. Technical background preferred.",
  },
  {
    id: "4", role: "Marketing Manager", level: "mid", company: "HubSpot", roleTitle: "Marketing Manager",
    profile: {
      name: "Candidate Four", careerLevel: "mid", country: "United States", location: "Boston, MA",
      email: "c4@example.com", phone: "+1 202 555 0104",
      summary: "Marketing manager focused on campaigns and content.",
      skills: ["digital marketing", "SEO", "content marketing", "email marketing", "social media", "Google Analytics"],
      experiences: [
        { title: "Marketing Manager", company: "BrandCo", start: "2020", end: "2024",
          bullets: ["Ran marketing campaigns", "Managed social media accounts", "Wrote blog content", "Tracked campaign performance"] },
      ],
      education: [{ degree: "B.A. Marketing", school: "State University", year: "2018" }],
      projects: [], certifications: [], languages: [],
    },
    jdText: "HubSpot is looking for a Marketing Manager to own demand generation. You will plan and execute multi-channel campaigns across SEO, paid, email, and social, manage the content calendar, optimize conversion funnels, and report on pipeline and ROI. Required: 4+ years in B2B marketing, hands-on with HubSpot or Marketo, SEO and SEM, marketing analytics (Google Analytics, attribution), A/B testing, and demand-gen strategy. Strong copywriting and data-driven decision making required.",
  },
  {
    id: "5", role: "Registered Nurse", level: "mid", company: "Mayo Clinic", roleTitle: "Registered Nurse",
    profile: {
      name: "Candidate Five", careerLevel: "mid", country: "United States", location: "Rochester, MN",
      email: "c5@example.com", phone: "+1 202 555 0105",
      summary: "Registered nurse with hospital experience.",
      skills: ["patient care", "medication administration", "EHR", "vital signs", "patient education"],
      experiences: [
        { title: "Registered Nurse", company: "General Hospital", start: "2019", end: "2024",
          bullets: ["Cared for patients", "Gave medications", "Updated patient records", "Worked with doctors"] },
      ],
      education: [{ degree: "BSN Nursing", school: "Nursing School", year: "2019" }],
      projects: [], certifications: ["RN License", "BLS"], languages: [],
    },
    jdText: "Mayo Clinic seeks a Registered Nurse for our medical-surgical unit. Responsibilities: deliver direct patient care, administer medications safely, monitor and document vital signs in the EHR (Epic), develop care plans, educate patients and families, and collaborate with the interdisciplinary care team. Requirements: active RN license, BSN preferred, BLS and ACLS certification, 2+ years acute care experience, strong clinical assessment skills, and proficiency with electronic health records. Compassionate, detail-oriented, and able to work in a fast-paced environment.",
  },
  {
    id: "6", role: "Accountant", level: "mid", company: "Deloitte", roleTitle: "Senior Accountant",
    profile: {
      name: "Candidate Six", careerLevel: "mid", country: "United States", location: "New York, NY",
      email: "c6@example.com", phone: "+1 202 555 0106",
      summary: "Accountant with experience in financial reporting.",
      skills: ["accounting", "Excel", "financial reporting", "reconciliation", "QuickBooks", "GAAP"],
      experiences: [
        { title: "Accountant", company: "FinanceCorp", start: "2019", end: "2024",
          bullets: ["Prepared financial statements", "Did account reconciliations", "Helped with audits", "Processed invoices"] },
      ],
      education: [{ degree: "B.S. Accounting", school: "State University", year: "2019" }],
      projects: [], certifications: ["CPA"], languages: [],
    },
    jdText: "Deloitte is hiring a Senior Accountant. You will own month-end close, prepare financial statements in accordance with GAAP, perform account reconciliations, support external audits, analyze variances, and improve accounting processes. Requirements: CPA or CPA-track, 3+ years accounting experience, strong GAAP knowledge, advanced Excel, experience with ERP systems (SAP, Oracle, or NetSuite), and strong analytical and reconciliation skills. Attention to detail and ability to meet close deadlines essential.",
  },
  {
    id: "7", role: "Sales Representative", level: "entry", company: "Salesforce", roleTitle: "Sales Development Representative",
    profile: {
      name: "Candidate Seven", careerLevel: "entry", country: "United States", location: "Austin, TX",
      email: "c7@example.com", phone: "+1 202 555 0107",
      summary: "Motivated sales professional looking to grow.",
      skills: ["sales", "communication", "CRM", "cold calling", "customer relationships"],
      experiences: [
        { title: "Sales Associate", company: "RetailStore", start: "2022", end: "2024",
          bullets: ["Sold products to customers", "Met sales targets", "Handled customer questions"] },
      ],
      education: [{ degree: "B.A. Communications", school: "State University", year: "2022" }],
      projects: [], certifications: [], languages: [],
    },
    jdText: "Salesforce seeks a Sales Development Representative (SDR) to generate pipeline. You will prospect and qualify leads, conduct outbound cold calls and emails, book meetings for account executives, manage activity in Salesforce CRM, and hit monthly quota. Requirements: 0-2 years sales experience, excellent communication and objection handling, familiarity with CRM tools, experience with outreach cadences (Outreach, SalesLoft), and a goal-oriented, resilient attitude. SaaS or tech sales interest preferred.",
  },
  {
    id: "8", role: "Graphic Designer", level: "mid", company: "Adobe", roleTitle: "Graphic Designer",
    profile: {
      name: "Candidate Eight", careerLevel: "mid", country: "United States", location: "Los Angeles, CA",
      email: "c8@example.com", phone: "+1 202 555 0108",
      summary: "Creative graphic designer with agency experience.",
      skills: ["Photoshop", "Illustrator", "InDesign", "branding", "typography", "layout"],
      experiences: [
        { title: "Graphic Designer", company: "DesignAgency", start: "2020", end: "2024",
          bullets: ["Designed marketing materials", "Created brand assets", "Worked with clients on projects"] },
      ],
      education: [{ degree: "BFA Graphic Design", school: "Art School", year: "2019" }],
      projects: [{ name: "Brand Refresh", detail: "Redesigned a client's visual identity" }], certifications: [], languages: [],
    },
    jdText: "Adobe is looking for a Graphic Designer to create compelling visual content. You will design for digital and print across web, social, email, and campaigns, develop and maintain brand systems, create mockups and production-ready assets, and collaborate with marketing and product teams. Requirements: 3+ years design experience, expert in Adobe Creative Suite (Photoshop, Illustrator, InDesign, XD/Figma), strong typography and layout skills, a portfolio demonstrating brand and digital work, and the ability to manage multiple projects and deadlines.",
  },
  {
    id: "9", role: "Project Manager", level: "senior", company: "Amazon", roleTitle: "Senior Project Manager",
    profile: {
      name: "Candidate Nine", careerLevel: "senior", country: "United States", location: "Seattle, WA",
      email: "c9@example.com", phone: "+1 202 555 0109",
      summary: "Project manager who delivers projects on time.",
      skills: ["project management", "Agile", "Scrum", "stakeholder management", "risk management", "Jira"],
      experiences: [
        { title: "Project Manager", company: "EnterpriseCo", start: "2017", end: "2024",
          bullets: ["Managed cross-functional projects", "Tracked timelines and budgets", "Coordinated with stakeholders", "Ran status meetings"] },
      ],
      education: [{ degree: "B.S. Business", school: "State University", year: "2015" }],
      projects: [], certifications: ["PMP"], languages: [],
    },
    jdText: "Amazon seeks a Senior Project Manager to drive complex programs. You will define project scope and milestones, manage timelines, budgets, and risks, coordinate across engineering, ops, and business teams, remove blockers, and report status to leadership. Requirements: 5+ years project/program management, PMP or equivalent, strong Agile/Scrum experience, proficiency with Jira and roadmapping tools, excellent stakeholder management, and a track record delivering large initiatives on time. Data-driven and able to operate with ambiguity.",
  },
  {
    id: "10", role: "Customer Service", level: "entry", company: "Zendesk", roleTitle: "Customer Support Specialist",
    profile: {
      name: "Candidate Ten", careerLevel: "entry", country: "United States", location: "Remote",
      email: "c10@example.com", phone: "+1 202 555 0110",
      summary: "Recent graduate seeking a customer support role.",
      skills: ["customer service", "communication", "problem solving", "Microsoft Office"],
      experiences: [
        { title: "Customer Service Intern", company: "ServiceCo", start: "2023", end: "2024",
          bullets: ["Answered customer emails", "Helped resolve issues", "Updated the help docs"] },
      ],
      education: [{ degree: "B.A. Psychology", school: "State University", year: "2023" }],
      projects: [{ name: "Volunteer Help Desk", detail: "Ran a campus IT help desk for students" }], certifications: [], languages: ["English", "Spanish"],
    },
    jdText: "Zendesk is hiring a Customer Support Specialist. You will respond to customer inquiries via email, chat, and phone, troubleshoot product issues, document solutions in the knowledge base, escalate complex cases, and maintain high customer satisfaction (CSAT). Requirements: strong written and verbal communication, problem-solving skills, familiarity with help desk software (Zendesk, Intercom), ability to learn technical products, and a customer-first attitude. 0-2 years experience; recent graduates welcome. SaaS experience a plus.",
  },
];
