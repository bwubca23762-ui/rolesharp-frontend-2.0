import { q, hasDb } from "../lib/db";
import { readFileSync, existsSync } from "fs";

// Import real occupations from the O*NET database text export.
// Expects "Occupation Data.txt" (tab-separated: O*NET-SOC Code, Title, Description)
// at the path given by ONET_FILE (default ./data/onet/Occupation Data.txt).
// Download+unzip is done by the shell wrapper before running this.

const FILE = process.env.ONET_FILE ?? "data/onet/Occupation Data.txt";

// O*NET-SOC major group (first 2 digits) -> coarse sector label.
const MAJOR: Record<string, string> = {
  "11": "Management", "13": "Business & Finance", "15": "IT", "17": "Engineering",
  "19": "Science", "21": "Community & Social", "23": "Legal", "25": "Education",
  "27": "Arts & Media", "29": "Healthcare", "31": "Healthcare Support", "33": "Protective",
  "35": "Food Service", "37": "Maintenance", "39": "Personal Care", "41": "Sales",
  "43": "Administrative", "45": "Agriculture", "47": "Construction", "49": "Installation & Repair",
  "51": "Manufacturing", "53": "Transportation", "55": "Military",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function main() {
  if (!hasDb()) { console.error("No DATABASE_URL"); process.exit(1); }
  if (!existsSync(FILE)) { console.error(`Missing ${FILE}`); process.exit(1); }

  const lines = readFileSync(FILE, "utf8").split("\n").slice(1); // skip header
  let n = 0;
  const seen = new Set<string>();
  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 2) continue;
    const code = cols[0]?.trim();
    const title = cols[1]?.trim();
    if (!title) continue;
    const slug = slugify(title);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const sector = MAJOR[code?.slice(0, 2)] ?? "General";
    try {
      await q(
        `insert into roles (slug,title,sector,seniority,required_skills,preferred_skills,typical_bullets,certifications,source)
         values ($1,$2,$3,'mid','{}','{}','{}','{}','onet')
         on conflict (slug) do nothing`,
        [slug, title, sector],
      );
      n++;
    } catch { /* skip dup/bad */ }
  }
  const total = await q<{ n: string }>("select count(*)::int n from roles");
  console.log(`imported ~${n} role titles. roles total: ${total[0]?.n ?? 0}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
