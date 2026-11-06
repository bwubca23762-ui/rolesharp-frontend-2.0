"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X } from "@/app/icons";
import { TOOLS } from "@/lib/tools-registry";
import { TOOL_WORKSPACES, toolWorkspaceForPath } from "@/lib/tool-workspaces";
import { Badge, Button, Card, Label } from "@/components/ui/primitives";

export default function ToolsCatalogue() {
  const [selected, setSelected] = useState("all");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const groups = TOOL_WORKSPACES.map((workspace) => ({ ...workspace, tools: TOOLS.filter((tool) => toolWorkspaceForPath(tool.href)?.id === workspace.id) }));
  const visible = groups.filter((group) => selected === "all" || selected === group.id).map((group) => ({
    ...group, tools: group.tools.filter((tool) => !query || `${tool.name} ${tool.description} ${tool.tag} ${group.title}`.toLowerCase().includes(query)),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-4 border-b border-[var(--hairline)] pb-5 lg:grid-cols-[minmax(14rem,.65fr)_minmax(0,1.65fr)] lg:items-end lg:gap-12">
        <div className="min-w-0">
          <Label htmlFor="tools-search">Search tools</Label>
          <div className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-fg)]" />
            <input id="tools-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="E.g. ATS, bullets or salary"
              className="min-h-11 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] pl-10 pr-12 text-base text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] [&::-webkit-search-cancel-button]:hidden" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-fg)]"><X size={16} aria-hidden="true" /></button>}
          </div>
        </div>
        <div role="group" aria-label="Filter tools by workspace" className="flex flex-wrap gap-1.5">
          {[{ id: "all", title: "All workspaces" }, ...TOOL_WORKSPACES].map((workspace) => (
            <button key={workspace.id} type="button" aria-pressed={selected === workspace.id} onClick={() => setSelected(workspace.id)}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${selected === workspace.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-fg)] hover:bg-[var(--surface-2)]"}`}>
              {workspace.title}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-[var(--muted-fg)]" role="status">{visible.reduce((count, group) => count + group.tools.length, 0)} tools in {visible.length} workspace{visible.length === 1 ? "" : "s"}.</p>
      {visible.length === 0 ? (
        <Card className="py-8 text-center">
          <h2 className="text-lg font-semibold">No tools matched your search</h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">Try a different term or reset the filters.</p>
          <Button className="mt-4" variant="outline" onClick={() => { setSelected("all"); setSearch(""); }}>Reset filters</Button>
        </Card>
      ) : (
        <div aria-label="Career tools catalogue" className="min-w-0 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {visible.map((workspace) => (
            <section key={workspace.id} id={`workspace-${workspace.id}`} className="grid min-w-0 scroll-mt-24 gap-4 py-5 lg:grid-cols-[minmax(14rem,.65fr)_minmax(0,1.65fr)] lg:gap-12 lg:py-7">
              <header>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">{workspace.title}</h2>
                <p className="mt-1 max-w-[34ch] text-sm leading-6 text-[var(--muted-fg)]">{workspace.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button as="a" href={workspace.href} variant="outline" size="sm">Open workspace <span className="sr-only">{workspace.title}</span></Button>
                  {workspace.id === "fit" && <Button as="a" href="/jobs" variant="ghost" size="sm">Find jobs</Button>}
                  {workspace.id === "resume" && <Button as="a" href="/resume-maker" variant="ghost" size="sm">Manual builder</Button>}
                </div>
              </header>
              <ul className="min-w-0 divide-y divide-[var(--hairline)]">
                {workspace.tools.map((tool) => (
                  <li key={tool.href} className="min-w-0">
                    <Link href={tool.href} className="group flex min-w-0 items-start justify-between gap-3 rounded-sm py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
                      <span className="min-w-0">
                        <span className="block font-semibold text-[var(--fg)] transition-colors group-hover:text-[var(--primary)] motion-reduce:transition-none">{tool.name}</span>
                        <span className="mt-1 block text-sm leading-6 text-[var(--muted-fg)]">{tool.description}</span>
                      </span>
                      <Badge variant={tool.premium ? "premium" : "neutral"}>{tool.premium ? "Premium" : "Free"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
