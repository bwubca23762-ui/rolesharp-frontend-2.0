import { Lock } from "@/app/icons";
import { AuthShell, Button, Notice } from "@/components/ui/primitives";

type AuthRequiredStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  nextPath?: string;
};

export default function AuthRequiredState({
  title,
  description,
  actionLabel = "Log in",
  nextPath,
}: AuthRequiredStateProps) {
  const href = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  return (
    <AuthShell
      eyebrow="Private workspace"
      title={title}
      description={description}
      aside={(
        <Notice variant="neutral" icon={<Lock size={18} />}>
          Sign-in state and any connected application mailbox remain separate permissions.
        </Notice>
      )}
      className="bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-bg)]"
    >
      <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
        Continue securely
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        After login, RoleSharp returns to the workspace page that requested access.
      </p>
      <Button as="a" href={href} fullWidth className="mt-6">
        {actionLabel}
      </Button>
    </AuthShell>
  );
}
