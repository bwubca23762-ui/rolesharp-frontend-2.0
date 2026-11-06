"use client";

import { Select } from "@/components/ui/primitives";

export const APPLICATION_STAGES = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
] as const;

type ApplicationListRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  follow_up_at?: string | null;
};

export default function ApplicationList({ rows, onStageChange, busy = false }: {
  rows: ApplicationListRow[];
  onStageChange?: (id: string, next: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="desk-tracker-table" role="region" aria-label="Application list" tabIndex={0}>
      <table>
        <caption className="sr-only">Tracked applications</caption>
        <thead>
          <tr>
            <th scope="col">Company and role</th>
            <th scope="col">Stage</th>
            <th scope="col">Last activity</th>
            <th scope="col">Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((app) => {
            const activity = app.updated_at ?? app.created_at;
            return (
              <tr key={app.id}>
                <th scope="row"><strong>{app.company}</strong><span>{app.role}</span></th>
                <td>
                  {onStageChange ? (
                    <Select aria-label={`Stage for ${app.role} at ${app.company}`} value={app.status} disabled={busy} onChange={(event) => onStageChange(app.id, event.target.value)}>
                      {APPLICATION_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
                    </Select>
                  ) : APPLICATION_STAGES.find((stage) => stage.key === app.status)?.label ?? app.status}
                </td>
                <td>{activity ? <time dateTime={activity}>{new Date(activity).toLocaleDateString("en-US", { timeZone: "UTC" })}</time> : "—"}</td>
                <td>{app.follow_up_at ? <time dateTime={app.follow_up_at}>{app.follow_up_at.slice(0, 10)}</time> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
