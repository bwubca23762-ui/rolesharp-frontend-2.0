"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/admin/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/admin/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/admin/dropdown-menu";
import { useAdminRefresh } from "./query-client";
import { ADMIN_REFRESH_EVENT } from "./admin-shared";
import { adminNavigationItemsForPermissions, isAdminNavigationActive, adminBreadcrumbForPath } from "./navigation";

export default function AdminWorkspaceBar({
  active,
  permissions,
  principal,
  onRefresh,
  onTogglePalette,
}: {
  active: string;
  permissions: readonly string[];
  principal?: {
    email: string | null;
    displayName: string | null;
    roles: readonly string[];
    breakGlass: boolean;
  };
  onRefresh?: () => void;
  onTogglePalette: () => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  // Live telemetry: last-synced clock + subsystem health pills + auto-refresh
  // cadence with a countdown. Health comes from /api/admin/services
  // (ops-helper list) and is gated on system.read.
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const [cadence, setCadence] = useState<0 | 15 | 30 | 60>(0);
  const [cadenceLeft, setCadenceLeft] = useState(0);
  const [services, setServices] = useState<Array<{ unit: string; active: string }>>([]);
  const canReadSystem = permissions.includes("system.read");

  function fetchServices() {
    if (!canReadSystem) return;
    fetch("/api/admin/services", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((j: { services?: Array<{ unit: string; active: string }> }) => setServices(j.services ?? []))
      .catch(() => setServices([]));
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const invalidateAll = useAdminRefresh();
  const togglePaletteRef = useRef(onTogglePalette);
  togglePaletteRef.current = onTogglePalette;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k" || event.repeat) return;
      if (document.querySelector("#admin-navigation[aria-modal='true']")) return;
      event.preventDefault();
      setOpen(false);
      togglePaletteRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const navigationItems = useMemo(() => adminNavigationItemsForPermissions(permissions), [permissions]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? navigationItems.filter((item) =>
          `${item.label} ${item.group}`.toLowerCase().includes(value),
        )
      : navigationItems;
  }, [navigationItems, query]);
  const breadcrumb = adminBreadcrumbForPath(pathname);

  const name = principal?.displayName || principal?.email || "Operator";
  const roleLabel = principal?.breakGlass
    ? "Break-glass"
    : (principal?.roles?.[0] ? principal.roles[0].replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Operator");
  const initial = name.slice(0, 1).toUpperCase();

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign out failed. Try again.");
      window.location.href = "/admin";
    } catch {
      setLoggingOut(false);
    }
  }

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    const done = () => setRefreshing(false);
    setLastSyncedAt(Date.now());
    setCadenceLeft(cadence);
    // Local-fetch views (not useAdminQuery) listen for this DOM event and
    // reload their own data; onRefresh + invalidateAll cover the rest.
    window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT));
    fetchServices();
    onRefresh?.();
    Promise.resolve(invalidateAll()).finally(done);
  }

  useEffect(() => {
    setLastSyncedAt(Date.now());
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!cadence) { setCadenceLeft(0); return; }
    setCadenceLeft(cadence);
    const timer = setInterval(() => {
      setCadenceLeft((left) => {
        if (left <= 1) {
          setLastSyncedAt(Date.now());
          window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT));
          fetchServices();
          onRefreshRef.current?.();
          return cadence;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadence]);

  return (
    <div className="admin-workspace-bar" role="navigation" aria-label="Admin workspace navigation">
      <div className="admin-workspace-bar-main">
        <div className="min-w-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin">Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumb.group && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="px-1.5 py-0.5">{breadcrumb.group}</span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <label className="admin-command-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Jump to admin section</span>
          <input
            ref={inputRef}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); setHighlight(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (!open || !filtered.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((h) => (h + 1) % filtered.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const picked = filtered[Math.min(highlight, filtered.length - 1)];
                if (picked) window.location.assign(picked.href);
              }
            }}
            onBlur={() => { setTimeout(() => setOpen(false), 120); }}
            placeholder="Jump to a workspace..."
            aria-label="Jump to admin section"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? "admin-command-results" : undefined}
            role="combobox"
            aria-activedescendant={open && filtered.length ? `admin-command-option-${Math.min(highlight, filtered.length - 1)}` : undefined}
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="rsx-mono hidden text-[11px] text-admin-muted-fg md:inline" title="Last telemetry sync">
            Updated {Math.max(0, Math.round((nowTick - lastSyncedAt) / 1000))}s ago
          </span>
          {canReadSystem && (
            <span className="hidden items-center gap-1.5 xl:flex" aria-label="Subsystem health">
              {services.slice(0, 3).map((service) => (
                <span
                  key={service.unit}
                  className={`rsx-pill ${service.active === "active" ? "healthy" : "critical"}`}
                  title={`${service.unit}: ${service.active}`}
                >
                  {service.unit.replace("resume-", "").replace("rolesharp-", "").slice(0, 12)}
                </span>
              ))}
              {!services.length && <span className="rsx-pill staged">Telemetry unavailable</span>}
            </span>
          )}
          <select
            value={cadence}
            onChange={(event) => setCadence(Number(event.target.value) as 0 | 15 | 30 | 60)}
            aria-label="Auto-refresh cadence"
            title="Auto-refresh cadence"
            className="h-8 rounded-md border border-admin-border bg-admin-surface px-2 text-xs font-semibold text-admin-fg"
          >
            <option value={0}>Auto: off</option>
            <option value={15}>15s{cadence === 15 && cadenceLeft ? ` · ${cadenceLeft}s` : ""}</option>
            <option value={30}>30s{cadence === 30 && cadenceLeft ? ` · ${cadenceLeft}s` : ""}</option>
            <option value={60}>60s{cadence === 60 && cadenceLeft ? ` · ${cadenceLeft}s` : ""}</option>
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            aria-label="Refresh data"
            title="Refresh data"
            disabled={refreshing}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-admin-border bg-admin-surface py-1 pl-1 pr-2.5 transition-colors hover:bg-admin-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-ring"
                aria-label={`Account menu for ${name}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-admin-primary text-admin-primary-fg text-xs font-semibold" aria-hidden>
                  {initial}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-semibold text-admin-fg">{name}</span>
                  <span className="block text-[10px] font-medium text-admin-muted-fg">{roleLabel}</span>
                </span>
                <ChevronDown size={14} className="text-admin-muted-fg" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="block truncate text-xs font-normal text-admin-muted-fg">{principal?.email ?? "No email on file"}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} disabled={loggingOut}>
                <LogOut size={14} /> {loggingOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {open && (
        <div id="admin-command-results" className="admin-command-results" role="listbox" aria-label="Admin sections">
          {filtered.length ? filtered.map((item, index) => {
            const Icon = item.icon;
            const activeItemLink = isAdminNavigationActive(active, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`admin-command-option-${index}`}
                className={`${activeItemLink ? "active" : ""} ${index === Math.min(highlight, filtered.length - 1) ? "highlighted" : ""}`.trim() || undefined}
                role="option"
                aria-selected={index === Math.min(highlight, filtered.length - 1)}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => { setOpen(false); setQuery(""); }}
              >
                <Icon size={16} />
                <span><b>{item.label}</b><small>{item.group}</small></span>
                <kbd aria-hidden>↵</kbd>
              </Link>
            );
          }) : <p className="text-[var(--muted-fg)]">No admin section matches “{query}”.</p>}
        </div>
      )}
    </div>
  );
}
