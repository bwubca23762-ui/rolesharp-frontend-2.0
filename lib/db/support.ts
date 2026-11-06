import { q, withTransaction } from "./core";

export type TicketStatus = "open" | "answered" | "resolved";

export async function createTicket(ticket: {
  userId?: string | null;
  email: string;
  name?: string;
  subject: string;
  body: string;
}) {
  return withTransaction(async (query) => {
    const rows = await query<{ id: string }>(
      `insert into support_tickets (user_id_text, email, name, subject, last_actor)
       values ($1,$2,$3,$4,'user') returning id`,
      [ticket.userId ?? null, ticket.email, ticket.name ?? null, ticket.subject],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("support_ticket_not_created");
    await query(
      "insert into support_messages (ticket_id, author, body) values ($1,'user',$2)",
      [id, ticket.body],
    );
    return id;
  });
}

export async function listUserTickets(userId: string) {
  return q(
    `select t.id, t.subject, t.status, t.last_actor, t.created_at, t.updated_at,
            (select count(*) from support_messages m where m.ticket_id = t.id)::int as message_count
     from support_tickets t
     where t.user_id_text=$1 order by t.updated_at desc`,
    [userId],
  );
}

export async function getTicket(id: string, opts: { userId?: string | null; isAdmin?: boolean }) {
  const rows = await q<any>("select * from support_tickets where id=$1", [id]);
  const ticket = rows[0];
  if (!ticket) return null;
  if (!opts.isAdmin && (!opts.userId || ticket.user_id_text !== opts.userId)) return null;
  const messages = await q(
    "select id, author, body, created_at from support_messages where ticket_id=$1 order by created_at",
    [id],
  );
  return { ...ticket, messages };
}

export async function addTicketMessage(id: string, author: "user" | "admin", body: string) {
  await withTransaction(async (query) => {
    const ticket = await query<{ id: string }>(
      "select id from support_tickets where id=$1 for update",
      [id],
    );
    if (!ticket[0]) throw new Error("support_ticket_not_found");
    await query(
      "insert into support_messages (ticket_id, author, body) values ($1,$2,$3)",
      [id, author, body],
    );
    await query(
      `update support_tickets
       set updated_at=now(), last_actor=$2,
           status=case when $2='user' then 'open' else 'answered' end
       where id=$1`,
      [id, author],
    );
  });
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  await q("update support_tickets set status=$2, updated_at=now() where id=$1", [id, status]);
}

export async function listAllTickets(status?: TicketStatus) {
  const where = status ? "where t.status=$1" : "";
  const params = status ? [status] : [];
  return q(
    `select t.id, t.subject, t.status, t.email, t.name, t.last_actor, t.user_id_text, t.created_at, t.updated_at,
            (select count(*) from support_messages m where m.ticket_id = t.id)::int as message_count
     from support_tickets t ${where}
     order by (t.status='open') desc, (t.status='answered') desc, t.updated_at desc limit 200`,
    params,
  );
}

export async function countOpenTickets() {
  const rows = await q<{ n: string }>(
    "select count(*)::int n from support_tickets where status='open'",
  );
  return Number(rows[0]?.n ?? 0);
}
