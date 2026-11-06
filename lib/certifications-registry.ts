export const CERTIFICATION_CATEGORIES = ["tech", "data-ai", "cloud", "cybersecurity", "marketing", "business"] as const;
export type CertificationCategory = (typeof CERTIFICATION_CATEGORIES)[number];
export const CERTIFICATION_PROVIDERS = ["Cisco Networking Academy", "Google Skillshop", "Harvard CS50", "HubSpot Academy", "Kaggle"] as const;
export type CertificationProvider = (typeof CERTIFICATION_PROVIDERS)[number];
export type CredentialType = "certificate" | "digital badge" | "applied credential";
export type CertificationLevel = "Beginner" | "Intermediate" | "Advanced";

export type FreeCertification = {
  id: string;
  title: string;
  provider: CertificationProvider;
  category: CertificationCategory;
  credentialType: CredentialType;
  url: string;
  durationHours: number | null;
  level: CertificationLevel;
  skills: string[];
  description: string;
  resumeTitle: string;
  evidencePrompt: string;
  targetRoles: string[];
  requirements: string;
  verifiedAt: string;
};

// Only include provider pages that state both no-cost access and a shareable
// credential. Recheck this list before expanding it; provider terms can change.
export const FREE_CERTIFICATIONS: readonly FreeCertification[] = [
  {
    id: "kaggle-python", title: "Python", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/python", durationHours: 5, level: "Beginner", skills: ["Python", "Programming", "Data science"],
    description: "Learn Python fundamentals through short lessons and coding exercises.", resumeTitle: "Python — Kaggle Learn",
    evidencePrompt: "Describe a real notebook or project where you used Python after completing this course.", targetRoles: ["Data Analyst", "Junior Python Developer"],
    requirements: "Free Kaggle account; course completion exercises earn the certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-intro-programming", title: "Intro to Programming", provider: "Kaggle", category: "tech", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/intro-to-programming/course", durationHours: 5, level: "Beginner", skills: ["Python", "Programming", "Functions"],
    description: "A first programming course using Python variables, functions, conditions, and lists.", resumeTitle: "Intro to Programming — Kaggle Learn",
    evidencePrompt: "Name a small program you wrote and what it does; include only work you actually completed.", targetRoles: ["Junior Developer", "Data Analyst"],
    requirements: "Free Kaggle account; estimated five hours; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-pandas", title: "Pandas", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/pandas", durationHours: 4, level: "Beginner", skills: ["Python", "Pandas", "Data manipulation"],
    description: "Practice data selection, cleaning, grouping, and summary operations with pandas.", resumeTitle: "Pandas — Kaggle Learn",
    evidencePrompt: "Describe a dataset you cleaned or analyzed with pandas and the steps you personally performed.", targetRoles: ["Data Analyst", "Data Scientist"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-intro-ml", title: "Intro to Machine Learning", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/intro-to-machine-learning", durationHours: 3, level: "Beginner", skills: ["Machine learning", "Python", "Model validation"],
    description: "Build and validate introductory machine-learning models with hands-on exercises.", resumeTitle: "Intro to Machine Learning — Kaggle Learn",
    evidencePrompt: "Describe a model you trained or evaluated; name the data and metric only if you used them.", targetRoles: ["Data Analyst", "Junior Data Scientist"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-intermediate-ml", title: "Intermediate Machine Learning", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/intermediate-machine-learning", durationHours: 4, level: "Intermediate", skills: ["Machine learning", "Pandas", "Feature engineering"],
    description: "Work with missing values, categorical variables, pipelines, validation, and data leakage.", resumeTitle: "Intermediate Machine Learning — Kaggle Learn",
    evidencePrompt: "Explain which model-improvement technique you applied in a project and what you observed.", targetRoles: ["Data Scientist", "Machine Learning Engineer"],
    requirements: "Free Kaggle account; basic Python and machine-learning knowledge recommended.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-intro-sql", title: "Intro to SQL", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/intro-to-sql", durationHours: 3, level: "Beginner", skills: ["SQL", "BigQuery", "Databases"],
    description: "Learn SQL queries, filtering, aggregation, joins, and analytic functions.", resumeTitle: "Intro to SQL — Kaggle Learn",
    evidencePrompt: "Describe a real query or data question you solved with SQL after taking this course.", targetRoles: ["Data Analyst", "Business Intelligence Analyst"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-advanced-sql", title: "Advanced SQL", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/advanced-sql", durationHours: 4, level: "Intermediate", skills: ["SQL", "BigQuery", "Window functions"],
    description: "Practice joins, unions, analytic functions, nested data, and efficient queries.", resumeTitle: "Advanced SQL — Kaggle Learn",
    evidencePrompt: "Describe a query you wrote using joins or analytic functions and what data it helped analyze.", targetRoles: ["Data Analyst", "Business Intelligence Analyst"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-data-viz", title: "Data Visualization", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/data-visualization", durationHours: 4, level: "Beginner", skills: ["Data visualization", "Python", "Seaborn"],
    description: "Create and customize data visualizations using Python and Seaborn.", resumeTitle: "Data Visualization — Kaggle Learn",
    evidencePrompt: "Name a chart you created, what it showed, and the dataset you used.", targetRoles: ["Data Analyst", "Business Intelligence Analyst"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-deep-learning", title: "Intro to Deep Learning", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/intro-to-deep-learning", durationHours: 4, level: "Intermediate", skills: ["Deep learning", "TensorFlow", "Keras"],
    description: "Train neural networks with TensorFlow and Keras through guided coding lessons.", resumeTitle: "Intro to Deep Learning — Kaggle Learn",
    evidencePrompt: "Describe a neural network you trained and the dataset or task it used.", targetRoles: ["Machine Learning Engineer", "Data Scientist"],
    requirements: "Free Kaggle account; Python and introductory machine-learning study recommended.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-feature-engineering", title: "Feature Engineering", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/feature-engineering", durationHours: 5, level: "Intermediate", skills: ["Feature engineering", "Pandas", "Machine learning"],
    description: "Create and improve model features with mutual information, transformations, clustering, and encoding.", resumeTitle: "Feature Engineering — Kaggle Learn",
    evidencePrompt: "Name a feature you created or transformed and how you evaluated its usefulness.", targetRoles: ["Data Scientist", "Machine Learning Engineer"],
    requirements: "Free Kaggle account; introductory machine-learning knowledge recommended.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-computer-vision", title: "Computer Vision", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/computer-vision", durationHours: 4, level: "Intermediate", skills: ["Computer vision", "TensorFlow", "Keras", "Deep learning"],
    description: "Build convolutional neural networks and practice image classification with TensorFlow and Keras.", resumeTitle: "Computer Vision — Kaggle Learn",
    evidencePrompt: "Describe an image model or computer-vision exercise you completed and the data it used.", targetRoles: ["Machine Learning Engineer", "Computer Vision Engineer"],
    requirements: "Free Kaggle account; introductory deep-learning knowledge recommended.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-data-cleaning", title: "Data Cleaning", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/data-cleaning", durationHours: 4, level: "Beginner", skills: ["Data cleaning", "Python", "Pandas", "Data quality"],
    description: "Practice missing-value handling, scaling, date parsing, encoding, and inconsistent data cleanup.", resumeTitle: "Data Cleaning — Kaggle Learn",
    evidencePrompt: "Describe a dataset issue you corrected and how you checked the cleaned data.", targetRoles: ["Data Analyst", "Data Quality Analyst"],
    requirements: "Free Kaggle account; basic Python and pandas knowledge recommended.", verifiedAt: "2026-09-25",
  },
  {
    id: "kaggle-geospatial", title: "Geospatial Analysis", provider: "Kaggle", category: "data-ai", credentialType: "certificate",
    url: "https://www.kaggle.com/learn/geospatial-analysis", durationHours: 4, level: "Intermediate", skills: ["Geospatial analysis", "GeoPandas", "Data visualization"],
    description: "Explore coordinate systems, interactive maps, and spatial analysis using GeoPandas.", resumeTitle: "Geospatial Analysis — Kaggle Learn",
    evidencePrompt: "Describe a map or spatial analysis you built and what question it answered.", targetRoles: ["GIS Analyst", "Data Analyst"],
    requirements: "Free Kaggle account; course completion earns a certificate.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-digital-marketing", title: "Digital Marketing Certification", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/digital-marketing", durationHours: 3.4, level: "Beginner", skills: ["Digital marketing", "SEO", "Email marketing", "Social media"],
    description: "Build a digital marketing foundation across content, search, email, social, and advertising.", resumeTitle: "Digital Marketing Certification — HubSpot Academy",
    evidencePrompt: "Name a marketing plan, campaign, or analysis you created and the part you owned.", targetRoles: ["Digital Marketing Specialist", "Marketing Coordinator"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-content-marketing", title: "Content Marketing Certification", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/content-marketing", durationHours: 8.4, level: "Beginner", skills: ["Content marketing", "SEO", "Content strategy"],
    description: "Learn content strategy, search optimization, planning, and performance measurement.", resumeTitle: "Content Marketing Certification — HubSpot Academy",
    evidencePrompt: "Describe a content piece or plan you created and how you evaluated its performance.", targetRoles: ["Content Marketer", "SEO Specialist"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-social-media", title: "Social Media Marketing Certification", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/social-media", durationHours: 5.3, level: "Beginner", skills: ["Social media", "Content strategy", "Analytics"],
    description: "Study social media strategy, content, audience growth, and measurement.", resumeTitle: "Social Media Marketing Certification — HubSpot Academy",
    evidencePrompt: "Describe a real social campaign or content calendar you worked on and your contribution.", targetRoles: ["Social Media Manager", "Marketing Coordinator"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-inbound", title: "Inbound Certification", provider: "HubSpot Academy", category: "business", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/inbound", durationHours: 3, level: "Beginner", skills: ["Inbound marketing", "Buyer personas", "Customer journey"],
    description: "Learn customer-centered inbound strategy, buyer personas, and the customer journey.", resumeTitle: "Inbound Certification — HubSpot Academy",
    evidencePrompt: "Describe how you mapped a customer journey or applied an inbound approach in your work.", targetRoles: ["Marketing Associate", "Sales Development Representative"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-inbound-marketing", title: "Inbound Marketing Certification", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/inbound-marketing", durationHours: 4.9, level: "Beginner", skills: ["Inbound marketing", "Lead nurturing", "Marketing automation"],
    description: "Develop inbound marketing skills in content, lead nurturing, automation, and reporting.", resumeTitle: "Inbound Marketing Certification — HubSpot Academy",
    evidencePrompt: "Name an inbound campaign or workflow you built and the audience or goal it served.", targetRoles: ["Inbound Marketing Specialist", "Marketing Associate"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-inbound-sales", title: "Inbound Sales Certification", provider: "HubSpot Academy", category: "business", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/inbound-sales", durationHours: 3.1, level: "Beginner", skills: ["Inbound sales", "Prospecting", "Buyer qualification"],
    description: "Practice identifying prospects, personalized outreach, exploratory conversations, and advising.", resumeTitle: "Inbound Sales Certification — HubSpot Academy",
    evidencePrompt: "Describe a real prospecting or customer-discovery task you performed; do not invent results.", targetRoles: ["Sales Development Representative", "Account Executive"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-sales-enablement", title: "Sales Enablement Certification", provider: "HubSpot Academy", category: "business", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/Sales-Enablement", durationHours: 7.3, level: "Intermediate", skills: ["Sales enablement", "Lead qualification", "Sales operations"],
    description: "Learn goal alignment, qualification frameworks, service-level agreements, and sales operations.", resumeTitle: "Sales Enablement Certification — HubSpot Academy",
    evidencePrompt: "Describe a sales process, enablement resource, or qualification framework you contributed to.", targetRoles: ["Sales Enablement Specialist", "Sales Operations Analyst"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-inbound-optimization", title: "Inbound Marketing Optimization", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/inbound-marketing-optimization", durationHours: 4.6, level: "Intermediate", skills: ["Inbound marketing", "Marketing analytics", "Optimization"],
    description: "Refine inbound strategies with customer insights and data-informed marketing projects.", resumeTitle: "Inbound Marketing Optimization — HubSpot Academy",
    evidencePrompt: "Describe a marketing process you improved and which evidence informed the change.", targetRoles: ["Marketing Analyst", "Growth Marketing Specialist"],
    requirements: "Free HubSpot Academy account; course and certification assessment are free.", verifiedAt: "2026-09-25",
  },
  {
    id: "hubspot-aeo", title: "AEO Fundamentals", provider: "HubSpot Academy", category: "marketing", credentialType: "certificate",
    url: "https://academy.hubspot.com/courses/aeo-fundamentals-certification-en", durationHours: null, level: "Beginner", skills: ["SEO", "Search strategy", "Analytics", "AI search"],
    description: "Explore search intent, content structure, and measurement across traditional and answer engines.", resumeTitle: "AEO Fundamentals — HubSpot Academy",
    evidencePrompt: "Name a search or content audit you performed and the findings you can substantiate.", targetRoles: ["SEO Specialist", "Content Strategist"],
    requirements: "Free HubSpot Academy account; verify current lesson duration on the course page.", verifiedAt: "2026-09-25",
  },
  {
    id: "harvard-cs50x", title: "CS50x: Introduction to Computer Science", provider: "Harvard CS50", category: "tech", credentialType: "certificate",
    url: "https://cs50.harvard.edu/x/certificate/", durationHours: null, level: "Intermediate", skills: ["Computer science", "C", "Python", "SQL", "Algorithms"],
    description: "A rigorous introduction to computer science with programming assignments and a final project.", resumeTitle: "CS50x: Introduction to Computer Science — Harvard CS50",
    evidencePrompt: "Describe your final project: its purpose, languages or tools used, and your individual contribution.", targetRoles: ["Software Developer", "Computer Science Student"],
    requirements: "Free access and free CS50 certificate when course requirements are met; edX verified certificates may cost extra.", verifiedAt: "2026-09-25",
  },
  {
    id: "google-ads", title: "Google Ads Certifications", provider: "Google Skillshop", category: "marketing", credentialType: "certificate",
    url: "https://skillshop.withgoogle.com/googleads/", durationHours: null, level: "Beginner", skills: ["Google Ads", "Digital advertising", "Campaign measurement"],
    description: "Self-paced Google Ads training with certification tracks for advertising specialties.", resumeTitle: "Google Ads Certification — Google Skillshop",
    evidencePrompt: "Name the Google Ads campaign type you studied or managed and what tasks you performed.", targetRoles: ["Paid Search Specialist", "Digital Marketing Specialist"],
    requirements: "Google advertises the training and certifications as free; course duration depends on track.", verifiedAt: "2026-09-25",
  },
  {
    id: "cisco-intro-cybersecurity", title: "Introduction to Cybersecurity", provider: "Cisco Networking Academy", category: "cybersecurity", credentialType: "digital badge",
    url: "https://www.netacad.com/courses/introduction-to-cybersecurity", durationHours: 6, level: "Beginner", skills: ["Cybersecurity", "Threat detection", "Network security", "Privacy"],
    description: "Self-paced introduction to cybersecurity concepts, threats, and protective practices.", resumeTitle: "Introduction to Cybersecurity Digital Badge — Cisco Networking Academy",
    evidencePrompt: "Describe a cybersecurity exercise or threat analysis you completed in the course.", targetRoles: ["Cybersecurity Analyst", "IT Support Specialist"],
    requirements: "Cisco lists this as a free online course; badge availability and language may vary by region.", verifiedAt: "2026-09-25",
  },
];

export const AVAILABLE_CERTIFICATION_CATEGORIES = CERTIFICATION_CATEGORIES.filter((category) => FREE_CERTIFICATIONS.some((item) => item.category === category));

export function certificationsForSkills(skills: readonly string[], limit = 3) {
  const wanted = new Set(skills.map((skill) => skill.trim().toLocaleLowerCase()).filter(Boolean));
  if (!wanted.size) return [];
  return FREE_CERTIFICATIONS
    .map((item) => ({ item, score: item.skills.reduce((count, skill) => count + Number(wanted.has(skill.toLocaleLowerCase())), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
