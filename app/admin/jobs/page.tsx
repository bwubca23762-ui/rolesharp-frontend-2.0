import AdminPanel from "../admin-panel";

export const metadata = {
  title: "Admin Job Listings",
};

export default function AdminJobs() {
  return <AdminPanel view="jobs" />;
}
