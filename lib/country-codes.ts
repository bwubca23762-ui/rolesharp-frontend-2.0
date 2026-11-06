// ISO 3166-1 alpha-2 fallback. The live API remains authoritative because it
// carries database counts and resume rules; this list keeps country selection
// usable during an empty seed, database outage, or first local setup.
const ISO_ALPHA_2 = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/);

// The one copy. Four near-duplicates lived in lib/country-list.ts,
// app/api/geo, app/companies/[company] and app/first-visit-country; this is
// the validated form — the version that used to live here fed any input
// straight to fromCodePoint, so a non-ISO code produced garbage or threw.
export function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  const a = code.codePointAt(0)! - 0x41;
  const b = code.codePointAt(1)! - 0x41;
  if (a < 0 || a > 25 || b < 0 || b > 25) return "";
  return String.fromCodePoint(0x1f1e6 + a, 0x1f1e6 + b);
}

export type FallbackCountry = { code: string; name: string; flag: string; count: number; rules: Record<string, never> };

export function fallbackCountries(): FallbackCountry[] {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
  return ISO_ALPHA_2.map((code) => ({
    code,
    name: names?.of(code) || code,
    flag: flagEmoji(code),
    count: 0,
    rules: {},
  })).sort((a, b) => a.name.localeCompare(b.name));
}
