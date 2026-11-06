import { q, type TransactionQuery } from "./db";
import { env } from "./env";

export const NOTIFICATION_PAGE_SIZE_MAX = 50;
export type NotificationPreferenceCategory = "essential" | "product_updates" | "career_tips";
export type NotificationAudience = "all_authenticated" | "free" | "premium" | "student";
export type NotificationSurface = "inbox" | "banner" | "both";
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationItem = {
  id: string;
  publicationKey: string;
  versionNumber: number;
  category: "service" | "security" | "legal" | "product" | "career";
  preferenceCategory: NotificationPreferenceCategory;
  surface: NotificationSurface;
  severity: NotificationSeverity;
  material: boolean;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  effectiveAt: string;
  expiresAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  archivedAt: string | null;
};

export type NotificationPreferences = {
  productUpdatesEnabled: boolean;
  careerTipsEnabled: boolean;
};

type NotificationRow = {
  id: string;
  publication_key: string;
  version_number: number;
  category: NotificationItem["category"];
  preference_category: NotificationPreferenceCategory;
  surface: NotificationSurface;
  severity: NotificationSeverity;
  material: boolean;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  effective_at: string;
  expires_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  archived_at: string | null;
};

export type NotificationUserContext = {
  userId: string;
  premium: boolean;
  premiumSource?: string | null;
};

const LOCAL_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  productUpdatesEnabled: true,
  careerTipsEnabled: true,
};

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    publicationKey: row.publication_key,
    versionNumber: row.version_number,
    category: row.category,
    preferenceCategory: row.preference_category,
    surface: row.surface,
    severity: row.severity,
    material: row.material,
    title: row.title,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    archivedAt: row.archived_at,
  };
}

function eligibleSql() {
  return `v.status in ('scheduled','published')
    and v.effective_at<=now()
    and (v.expires_at is null or v.expires_at>now())
    and not exists (
      select 1 from notification_publication_versions newer
      where newer.publication_id=v.publication_id
        and newer.status in ('scheduled','published')
        and newer.effective_at<=now()
        and (newer.expires_at is null or newer.expires_at>now())
        and (newer.effective_at,newer.version_number)>(v.effective_at,v.version_number)
    )
    and (v.audience='all_authenticated'
      or (v.audience='premium' and $2::boolean)
      or (v.audience='free' and not $2::boolean)
      or (v.audience='student' and $3::text='student'))
    and (v.preference_category='essential'
      or (v.preference_category='product_updates' and coalesce(pref.product_updates_enabled,true))
      or (v.preference_category='career_tips' and coalesce(pref.career_tips_enabled,true)))`;
}

export async function listNotifications(
  context: NotificationUserContext,
  options: { limit?: number; before?: string | null; includeArchived?: boolean } = {},
  query: TransactionQuery = q,
): Promise<NotificationItem[]> {
  if (env.localDevMode && query === q) return [];
  const limit = Math.max(1, Math.min(NOTIFICATION_PAGE_SIZE_MAX, Math.trunc(options.limit ?? 20)));
  const before = options.before ? new Date(options.before) : null;
  const beforeIso = before && Number.isFinite(before.getTime()) ? before.toISOString() : null;
  const rows = await query<NotificationRow>(
    `with candidates as (
       select v.id
       from notification_publication_versions v
       left join notification_preferences pref on pref.user_id=$1
       left join notification_user_states s on s.user_id=$1 and s.publication_version_id=v.id
       where ${eligibleSql()}
         and ($4::timestamptz is null or v.effective_at<$4::timestamptz)
         and ($5::boolean or s.archived_at is null)
       order by v.effective_at desc,v.id desc
       limit $6
     ), seen as (
       insert into notification_user_states (user_id,publication_version_id)
       select $1,id from candidates
       on conflict (user_id,publication_version_id) do nothing
       returning publication_version_id
     )
     select v.id,p.publication_key,v.version_number,v.category,v.preference_category,v.surface,
       v.severity,v.material,v.title,v.body,v.cta_label,v.cta_url,v.effective_at,v.expires_at,
       s.read_at,s.dismissed_at,s.archived_at
     from candidates c
     join notification_publication_versions v on v.id=c.id
     join notification_publications p on p.id=v.publication_id
     join notification_user_states s on s.user_id=$1 and s.publication_version_id=v.id
     order by v.effective_at desc,v.id desc`,
    [context.userId, context.premium, context.premiumSource ?? null, beforeIso, !!options.includeArchived, limit],
  );
  return rows.map(mapNotification);
}

export async function unreadNotificationCount(context: NotificationUserContext, query: TransactionQuery = q): Promise<number> {
  if (env.localDevMode && query === q) return 0;
  const row = (await query<{ count: number }>(
    `select count(*)::int count
     from notification_publication_versions v
     left join notification_preferences pref on pref.user_id=$1
     left join notification_user_states s on s.user_id=$1 and s.publication_version_id=v.id
     where ${eligibleSql()}
       and s.read_at is null and s.archived_at is null`,
    [context.userId, context.premium, context.premiumSource ?? null],
  ))[0];
  return Number(row?.count ?? 0);
}

export async function currentMaterialBanner(context: NotificationUserContext, query: TransactionQuery = q): Promise<NotificationItem | null> {
  if (env.localDevMode && query === q) return null;
  const row = (await query<NotificationRow>(
    `select v.id,p.publication_key,v.version_number,v.category,v.preference_category,v.surface,
       v.severity,v.material,v.title,v.body,v.cta_label,v.cta_url,v.effective_at,v.expires_at,
       s.read_at,s.dismissed_at,s.archived_at
     from notification_publication_versions v
     join notification_publications p on p.id=v.publication_id
     left join notification_preferences pref on pref.user_id=$1
     left join notification_user_states s on s.user_id=$1 and s.publication_version_id=v.id
     where ${eligibleSql()} and v.material and v.surface in ('banner','both')
       and s.dismissed_at is null and s.archived_at is null
     order by v.severity='critical' desc,v.effective_at desc,v.id desc limit 1`,
    [context.userId, context.premium, context.premiumSource ?? null],
  ))[0];
  return row ? mapNotification(row) : null;
}

export async function updateNotificationState(
  userId: string,
  versionId: string,
  action: "read" | "dismiss" | "archive",
  query: TransactionQuery = q,
): Promise<boolean> {
  if (env.localDevMode && query === q) return false;
  const updates = action === "read"
    ? "read_at=coalesce(notification_user_states.read_at,now())"
    : action === "dismiss"
      ? "read_at=coalesce(notification_user_states.read_at,now()),dismissed_at=coalesce(notification_user_states.dismissed_at,now())"
      : "read_at=coalesce(notification_user_states.read_at,now()),archived_at=coalesce(notification_user_states.archived_at,now())";
  const inserted = await query<{ publication_version_id: string }>(
    `insert into notification_user_states (user_id,publication_version_id,read_at,dismissed_at,archived_at)
     select $1,v.id,
       case when $3 in ('read','dismiss','archive') then now() end,
       case when $3='dismiss' then now() end,
       case when $3='archive' then now() end
     from notification_publication_versions v
     where v.id=$2 and v.status in ('scheduled','published') and v.effective_at<=now()
       and (v.expires_at is null or v.expires_at>now())
     on conflict (user_id,publication_version_id) do update set ${updates}
     returning publication_version_id`,
    [userId, versionId, action],
  );
  return !!inserted[0];
}

/**
 * Marks every currently-effective, non-expired publication read for the user
 * in one statement. The "mark all" affordance: without it a user with many
 * unread notices clicks once per item.
 */
export async function markAllNotificationsRead(userId: string, query: TransactionQuery = q): Promise<number> {
  if (env.localDevMode && query === q) return 0;
  const rows = await query<{ publication_version_id: string }>(
    `insert into notification_user_states (user_id,publication_version_id,read_at)
     select $1,v.id,now()
     from notification_publication_versions v
     where v.status in ('scheduled','published') and v.effective_at<=now()
       and (v.expires_at is null or v.expires_at>now())
       and v.severity <> 'critical'
     on conflict (user_id,publication_version_id) do update
       set read_at=coalesce(notification_user_states.read_at,now())
     returning publication_version_id`,
    [userId],
  );
  return rows.length;
}

export async function getNotificationPreferences(userId: string, query: TransactionQuery = q): Promise<NotificationPreferences> {
  if (env.localDevMode && query === q) return { ...LOCAL_NOTIFICATION_PREFERENCES };
  const row = (await query<{ product_updates_enabled: boolean; career_tips_enabled: boolean }>(
    `select product_updates_enabled,career_tips_enabled from notification_preferences where user_id=$1`, [userId],
  ))[0];
  return {
    productUpdatesEnabled: row?.product_updates_enabled ?? true,
    careerTipsEnabled: row?.career_tips_enabled ?? true,
  };
}

export async function setNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
  query: TransactionQuery = q,
): Promise<NotificationPreferences> {
  if (env.localDevMode && query === q) {
    LOCAL_NOTIFICATION_PREFERENCES.productUpdatesEnabled = preferences.productUpdatesEnabled;
    LOCAL_NOTIFICATION_PREFERENCES.careerTipsEnabled = preferences.careerTipsEnabled;
    return { ...LOCAL_NOTIFICATION_PREFERENCES };
  }
  const row = (await query<{ product_updates_enabled: boolean; career_tips_enabled: boolean }>(
    `insert into notification_preferences (user_id,product_updates_enabled,career_tips_enabled)
     values ($1,$2,$3)
     on conflict (user_id) do update set product_updates_enabled=excluded.product_updates_enabled,
       career_tips_enabled=excluded.career_tips_enabled,updated_at=now()
     returning product_updates_enabled,career_tips_enabled`,
    [userId, preferences.productUpdatesEnabled, preferences.careerTipsEnabled],
  ))[0];
  return {
    productUpdatesEnabled: row?.product_updates_enabled ?? preferences.productUpdatesEnabled,
    careerTipsEnabled: row?.career_tips_enabled ?? preferences.careerTipsEnabled,
  };
}
