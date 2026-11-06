"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    theme="light"
    richColors
    position="bottom-right"
    toastOptions={{
      classNames: {
        toast:
          "group toast group-[.toaster]:border-admin-border group-[.toaster]:bg-admin-surface group-[.toaster]:text-admin-fg group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-admin-muted-fg",
        actionButton: "group-[.toast]:bg-admin-primary group-[.toast]:text-admin-primary-fg",
        cancelButton: "group-[.toast]:bg-admin-muted group-[.toast]:text-admin-fg",
      },
    }}
    {...props}
  />
);
Toaster.displayName = "Toaster";

export { Toaster };
