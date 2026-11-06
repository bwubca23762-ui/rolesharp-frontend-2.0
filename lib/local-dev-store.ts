type DevStore = typeof import("./dev-store");

let storePromise: Promise<DevStore> | null = null;

async function localStore(): Promise<DevStore> {
  if (process.env.LOCAL_DEV_MODE !== "true") {
    throw new Error("local dev store is disabled");
  }
  storePromise ??= import("./dev-store");
  return storePromise;
}

export async function createDevUser(email: string, passwordHash: string) {
  return (await localStore()).createDevUser(email, passwordHash);
}

export async function getDevUserByEmail(email: string) {
  return (await localStore()).getDevUserByEmail(email);
}

export async function getDevUserById(id: string) {
  return (await localStore()).getDevUserById(id);
}

export async function deleteDevUser(id: string) {
  return (await localStore()).deleteDevUser(id);
}

export async function grantDevPremium(userId: string, days: number) {
  return (await localStore()).grantDevPremium(userId, days);
}

export async function listDevUserResumes(userId: string) {
  return (await localStore()).listDevUserResumes(userId);
}

export async function saveDevResume(input: Parameters<DevStore["saveDevResume"]>[0]) {
  return (await localStore()).saveDevResume(input);
}

export async function getDevUserResume(id: string, userId: string) {
  return (await localStore()).getDevUserResume(id, userId);
}

export async function deleteDevUserResume(id: string, userId: string) {
  return (await localStore()).deleteDevUserResume(id, userId);
}

export async function updateDevResume(id: string, patch: Parameters<DevStore["updateDevResume"]>[1]) {
  return (await localStore()).updateDevResume(id, patch);
}

export async function countDevResumesSince(userId: string, sinceMs: number) {
  return (await localStore()).countDevResumesSince(userId, sinceMs);
}

export async function spendDevCredit(userId: string) {
  return (await localStore()).spendDevCredit(userId);
}

export async function getDevCredits(userId: string) {
  return (await localStore()).getDevCredits(userId);
}

export async function getDevInviteCode(userId: string) {
  return (await localStore()).getDevInviteCode(userId);
}

export async function searchDevCompanies(term: string, country?: string) {
  return (await localStore()).searchDevCompanies(term, country);
}

export async function listDevCompanies(limit = 30) {
  return (await localStore()).listDevCompanies(limit);
}

export async function listDevRoles(limit = 30) {
  return (await localStore()).listDevRoles(limit);
}

export async function searchDevRoles(term: string, limit = 20) {
  return (await localStore()).searchDevRoles(term, limit);
}

export async function listDevRolesWithSkills(limit = 60) {
  return (await localStore()).listDevRolesWithSkills(limit);
}

export async function getDevPublishedSite(handle: string) {
  return (await localStore()).getDevPublishedSite(handle);
}

export async function listDevIndexableSites() {
  return (await localStore()).listDevIndexableSites();
}

export async function getDevRoleBySlug(slug: string) {
  return (await localStore()).getDevRoleBySlug(slug);
}

export async function getDevCompanyBySlug(slug: string) {
  return (await localStore()).getDevCompanyBySlug(slug);
}
