export type LocaleDef = {
  slug: string;
  lang: string;
  country: string;
  nativeName: string;
  seoTitle: string;
  h1: string;
  description: string;
  summary: string;
  helpHeading: string;
  helpBullets: string[];
  startHeading: string;
  startText: string;
  buildCta: string;
  checkerCta: string;
  translatorCta: string;
  startTextLinks: {
    checker: string;
    builder: string;
    templates: string;
    examples: string;
    coverLetter: string;
  };
};

export const KEY_LOCALES: LocaleDef[] = [
  {
    slug: "en-us",
    lang: "en-US",
    country: "United States",
    nativeName: "English (United States)",
    seoTitle: "US Resume Builder & ATS Tools",
    h1: "Resume help for job seekers in the United States",
    description: "Build an ATS-friendly US resume, check it against a job description, and tailor each version to the company and role.",
    summary: "Build one-page US resumes, mirror the exact language of American job postings, and export ATS-safe PDFs before you apply.",
    helpHeading: "How RoleSharp helps in the United States",
    helpBullets: ["US-friendly formatting with clean, ATS-readable sections.", "Exact job-posting keywords matched to your real experience.", "Company-specific tailoring for the applications that matter.", "A simple workflow from resume check to final export."],
    startHeading: "Best pages to start with",
    startText: "Most users begin with the ATS resume checker, then move to the AI resume builder, resume templates, resume examples, and cover letter generator.",
    buildCta: "Build a tailored resume", checkerCta: "Check my resume", translatorCta: "Adapt for another market",
    startTextLinks: { checker: "ATS resume checker", builder: "AI resume builder", templates: "resume templates", examples: "resume examples", coverLetter: "cover letter generator" },
  },
  {
    slug: "en-gb",
    lang: "en-GB",
    country: "United Kingdom",
    nativeName: "English (United Kingdom)",
    seoTitle: "UK CV Builder & ATS Tools",
    h1: "CV and resume help for job seekers in the United Kingdom",
    description: "Build UK-ready CVs and ATS-friendly resumes tailored to employers in the United Kingdom.",
    summary: "Adjust length, wording, and structure for UK hiring norms, then tailor each CV to the role and employer before you send it.",
    helpHeading: "How RoleSharp helps in the United Kingdom",
    helpBullets: ["UK-ready CV structure and wording for local hiring expectations.", "ATS-readable sections with the terminology used in British job postings.", "Employer and role-specific tailoring instead of one generic CV.", "A practical path from fixing an old CV to exporting the final version."],
    startHeading: "Best pages to start with", startText: "Begin with the ATS CV checker, then use the AI resume builder, CV templates, CV examples, and cover letter generator.",
    buildCta: "Build a tailored CV", checkerCta: "Check my CV", translatorCta: "Adapt for another market",
    startTextLinks: { checker: "ATS CV checker", builder: "AI resume builder", templates: "CV templates", examples: "CV examples", coverLetter: "cover letter generator" },
  },
  {
    slug: "en-ca",
    lang: "en-CA",
    country: "Canada",
    nativeName: "English (Canada)",
    seoTitle: "Canada Resume Builder & ATS Tools",
    h1: "Resume help for job seekers in Canada",
    description: "Build an ATS-friendly Canadian resume, check job-description keywords, and tailor each version to the employer and role.",
    summary: "Create Canadian resumes that read cleanly in ATS systems, surface the right keywords, and stay easy for recruiters to scan.",
    helpHeading: "How RoleSharp helps in Canada", helpBullets: ["Clean Canadian resume formatting that remains easy for ATS tools to parse.", "Job-specific keywords matched to your real skills and results.", "Company-aware tailoring for Canadian employers.", "A clear workflow from checking your resume to exporting it."],
    startHeading: "Best pages to start with", startText: "Start with the ATS resume checker, then use the AI resume builder, resume templates, resume examples, and cover letter generator.",
    buildCta: "Build a tailored resume", checkerCta: "Check my resume", translatorCta: "Adapt for another market",
    startTextLinks: { checker: "ATS resume checker", builder: "AI resume builder", templates: "resume templates", examples: "resume examples", coverLetter: "cover letter generator" },
  },
  {
    slug: "en-in",
    lang: "en-IN",
    country: "India",
    nativeName: "English (India)",
    seoTitle: "India Resume Builder & ATS Tools",
    h1: "Resume help for job seekers in India",
    description: "Build resumes for Indian hiring markets, campus placements, and company-specific applications.",
    summary: "Use one strong base resume, tailor it to each company, and export versions that fit Indian placement and hiring expectations.",
    helpHeading: "How RoleSharp helps in India", helpBullets: ["Formatting for Indian hiring, campus placements, and ATS screening.", "Keywords aligned with the exact company and role you are targeting.", "Strong project, education, and internship presentation for early-career applicants.", "A workflow that moves from fixing a draft to a tailored application."],
    startHeading: "Best pages to start with", startText: "Start with the ATS resume checker, then use the AI resume builder, resume templates, resume examples, and cover letter generator.",
    buildCta: "Build a tailored resume", checkerCta: "Check my resume", translatorCta: "Adapt for another market",
    startTextLinks: { checker: "ATS resume checker", builder: "AI resume builder", templates: "resume templates", examples: "resume examples", coverLetter: "cover letter generator" },
  },
  {
    slug: "de-de",
    lang: "de-DE",
    country: "Germany",
    nativeName: "Deutsch (Deutschland)",
    seoTitle: "Lebenslauf- und ATS-Tools für Deutschland",
    h1: "Lebenslauf-Hilfe für Bewerbungen in Deutschland",
    description: "Erstelle einen ATS-tauglichen Lebenslauf für Deutschland und passe Inhalt, Aufbau und Schlüsselwörter an die Stelle an.",
    summary: "Passe deinen Lebenslauf an deutsche Bewerbungsstandards an, halte ihn für ATS-Systeme lesbar und richte jede Version auf den Arbeitgeber aus.",
    helpHeading: "So hilft RoleSharp bei Bewerbungen in Deutschland", helpBullets: ["Hinweise zu deutschen Lebenslauf- und Bewerbungsstandards.", "Klare, ATS-lesbare Abschnitte mit passenden Schlüsselwörtern.", "Anpassung an Unternehmen, Stelle und konkrete Ausschreibung.", "Ein übersichtlicher Ablauf vom Prüfen bis zum Export."],
    startHeading: "Die besten Seiten für den Einstieg", startText: "Starte mit dem ATS-Lebenslauf-Check und nutze danach den KI-Lebenslauf-Builder, Vorlagen, Beispiele und den Anschreiben-Generator.",
    buildCta: "Lebenslauf anpassen", checkerCta: "Lebenslauf prüfen", translatorCta: "Für einen anderen Markt anpassen",
    startTextLinks: { checker: "ATS-Lebenslauf-Check", builder: "KI-Lebenslauf-Builder", templates: "Lebenslauf-Vorlagen", examples: "Lebenslauf-Beispiele", coverLetter: "Anschreiben-Generator" },
  },
  {
    slug: "fr-fr",
    lang: "fr-FR",
    country: "France",
    nativeName: "Français (France)",
    seoTitle: "Outils CV et ATS pour la France",
    h1: "Aide CV pour les candidatures en France",
    description: "Créez un CV compatible ATS pour la France, puis adaptez sa structure, ses mots-clés et son contenu à chaque offre d’emploi.",
    summary: "Adapte ton CV aux attentes du marché français, renforce les formulations liées au poste et exporte un PDF prêt à envoyer.",
    helpHeading: "Comment RoleSharp aide les candidats en France", helpBullets: ["Structure et formulation adaptées aux candidatures françaises.", "Mots-clés de l'offre intégrés dans les expériences réelles.", "Personnalisation selon l'entreprise, le poste et le marché.", "Un parcours simple du diagnostic à l'export final."],
    startHeading: "Les meilleures pages pour commencer", startText: "Commence par le vérificateur ATS, puis utilise le créateur de CV, les modèles, les exemples et le générateur de lettre de motivation.",
    buildCta: "Créer un CV personnalisé", checkerCta: "Vérifier mon CV", translatorCta: "Adapter à un autre marché",
    startTextLinks: { checker: "vérificateur ATS", builder: "créateur de CV", templates: "modèles de CV", examples: "exemples de CV", coverLetter: "générateur de lettre de motivation" },
  },
  {
    slug: "es-es",
    lang: "es-ES",
    country: "Spain",
    nativeName: "Español (España)",
    seoTitle: "Herramientas de currículum y ATS para España",
    h1: "Ayuda con el currículum para buscar trabajo en España",
    description: "Crea un currículum compatible con ATS para España y adapta la estructura, las palabras clave y el contenido a cada oferta.",
    summary: "Adapta cada currículum al puesto, mantén un formato fácil de leer y crea versiones pensadas para empresas españolas.",
    helpHeading: "Cómo ayuda RoleSharp a los candidatos en España", helpBullets: ["Formato y estructura adecuados para el mercado laboral español.", "Palabras clave de la oferta conectadas con tu experiencia real.", "Personalización para cada empresa y puesto.", "Un flujo claro desde la revisión hasta la exportación."],
    startHeading: "Páginas recomendadas para empezar", startText: "Empieza con el comprobador ATS y continúa con el creador de currículums, las plantillas, los ejemplos y el generador de cartas de presentación.",
    buildCta: "Crear un currículum adaptado", checkerCta: "Revisar mi currículum", translatorCta: "Adaptar a otro mercado",
    startTextLinks: { checker: "comprobador ATS", builder: "creador de currículums", templates: "plantillas de currículum", examples: "ejemplos de currículum", coverLetter: "generador de cartas de presentación" },
  },
  {
    slug: "ja-jp",
    lang: "ja-JP",
    country: "Japan",
    nativeName: "日本語（日本）",
    seoTitle: "日本向け履歴書・ATS対策ツール",
    h1: "日本向けの履歴書と職務経歴書の準備",
    description: "日本の求人向けにATSで読み取りやすい履歴書・職務経歴書を作成し、応募先の企業や職種に合わせて内容とキーワードを調整できます。",
    summary: "日本の採用慣行に合わせた履歴書・職務経歴書を作成し、応募先の企業と職種に合わせて調整できます。",
    helpHeading: "日本での応募をRoleSharpがサポート", helpBullets: ["日本向けの履歴書・職務経歴書の構成ガイダンス。", "求人票のキーワードを実際の経験に自然に反映。", "企業・職種ごとの応募書類のカスタマイズ。", "チェックから書き出しまで分かりやすい応募フロー。"],
    startHeading: "まず見るページ", startText: "ATSチェック、AI履歴書ビルダー、テンプレート、履歴書の例、カバーレター作成から始められます。",
    buildCta: "応募先向けに作成", checkerCta: "履歴書をチェック", translatorCta: "別の市場向けに調整",
    startTextLinks: { checker: "ATS履歴書チェック", builder: "AI履歴書ビルダー", templates: "履歴書テンプレート", examples: "履歴書の例", coverLetter: "カバーレター作成" },
  },
  {
    slug: "ar-ae",
    lang: "ar-AE",
    country: "United Arab Emirates",
    nativeName: "العربية (الإمارات)",
    seoTitle: "أدوات السيرة الذاتية وATS في الإمارات",
    h1: "مساعدة في السيرة الذاتية للباحثين عن عمل في الإمارات",
    description: "أنشئ سيرة ذاتية متوافقة مع أنظمة ATS لسوق الإمارات، ثم خصّص التنسيق والكلمات المفتاحية والمحتوى لكل وظيفة.",
    summary: "أنشئ سيرة ذاتية مناسبة لسوق العمل في الإمارات، ثم خصصها لكل شركة ووظيفة مع تصدير آمن لأنظمة ATS.",
    helpHeading: "كيف يساعد RoleSharp الباحثين عن عمل في الإمارات", helpBullets: ["إرشادات تنسيق مناسبة لمتطلبات التوظيف في الإمارات.", "كلمات مفتاحية من إعلان الوظيفة مرتبطة بخبرتك الحقيقية.", "تخصيص السيرة حسب الشركة والوظيفة والسوق.", "مسار واضح من فحص السيرة إلى تصدير النسخة النهائية."],
    startHeading: "أفضل الصفحات للبدء", startText: "ابدأ بفحص السيرة لنظام ATS، ثم استخدم منشئ السيرة بالذكاء الاصطناعي والقوالب والأمثلة ومنشئ خطابات التقديم.",
    buildCta: "أنشئ سيرة مخصصة", checkerCta: "افحص سيرتي", translatorCta: "خصصها لسوق آخر",
    startTextLinks: { checker: "فحص السيرة لنظام ATS", builder: "منشئ السيرة بالذكاء الاصطناعي", templates: "قوالب السيرة", examples: "أمثلة السيرة", coverLetter: "منشئ خطاب التقديم" },
  },
];

export const LOCALE_LANGUAGE_ALTERNATES = {
  en: "/",
  ...Object.fromEntries(KEY_LOCALES.map((locale) => [locale.lang, `/${locale.slug}`])),
};

export function getLocale(slug: string) {
  return KEY_LOCALES.find((locale) => locale.slug === slug);
}
