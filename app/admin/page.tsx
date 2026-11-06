import AdminPanel from "./admin-panel";

export const metadata = {
  title: "Admin Overview",
};

export default function Admin() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AdminPanel view="overview" />
    </div>
  );
}
