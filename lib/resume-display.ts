export function displayHeadline(headline: string, candidateName: string): string {
  const cleanHeadline = headline.trim();
  const cleanName = candidateName.trim();
  if (!cleanName || !cleanHeadline.toLowerCase().startsWith(cleanName.toLowerCase())) return cleanHeadline;

  const rest = cleanHeadline.slice(cleanName.length).replace(/^\s*(?:[—–|:-]+)\s*/, "").trim();
  return rest || "Professional Resume";
}
