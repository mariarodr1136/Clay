"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  FolderKanban,
  History,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Item = {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
};

type Group = { heading: string; items: Item[] };

const NAV_TARGETS = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Views", href: "/views", icon: LayoutDashboard },
  { label: "Chat", href: "/chat", icon: MessageSquareText },
  { label: "Audit log", href: "/audit", icon: History },
] as const;

// Hand-rolled rather than pulling in a combobox library: the behaviour is
// a listbox with roving selection, and the ARIA contract for that is short
// enough to implement exactly — input owns focus, aria-activedescendant
// points at the highlighted option, and the list never steals the caret.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmed = query.trim();
  const searchQuery = trpc.search.all.useQuery(
    { q: trimmed },
    // Debounced by React Query's own caching rather than a timer: the
    // palette is only open briefly and the queries are indexed.
    { enabled: open && trimmed.length > 0, staleTime: 10_000 }
  );

  const groups = useMemo<Group[]>(() => {
    const navItems: Item[] = NAV_TARGETS.filter((target) =>
      trimmed ? target.label.toLowerCase().includes(trimmed.toLowerCase()) : true
    ).map((target) => ({
      key: `nav:${target.href}`,
      label: target.label,
      icon: target.icon,
      run: () => router.push(target.href),
    }));

    const result: Group[] = [];
    const data = searchQuery.data;

    if (data?.projects.length) {
      result.push({
        heading: "Projects",
        items: data.projects.map((project) => ({
          key: `project:${project.id}`,
          label: project.name,
          icon: FolderKanban,
          run: () => router.push(`/projects/${project.id}`),
        })),
      });
    }

    if (data?.views.length) {
      result.push({
        heading: "Views",
        items: data.views.map((view) => ({
          key: `view:${view.id}`,
          label: view.name,
          hint: view.scope === "org" ? "shared" : undefined,
          icon: LayoutDashboard,
          run: () => router.push(`/views/${view.id}`),
        })),
      });
    }

    if (data?.tasks.length) {
      result.push({
        heading: "Tasks",
        items: data.tasks.map((task) => ({
          key: `task:${task.id}`,
          label: task.title,
          hint: task.projectName,
          icon: CheckSquare,
          run: () => router.push(`/projects/${task.projectId}`),
        })),
      });
    }

    if (navItems.length) result.push({ heading: "Go to", items: navItems });

    // Free text always leaves an escape hatch to the agent — the palette
    // doubles as the front door for "build me a dashboard of…", which is
    // the app's whole premise.
    if (trimmed) {
      result.push({
        heading: "Ask Clay",
        items: [
          {
            key: "agent",
            label: `Ask the agent: "${trimmed}"`,
            icon: Sparkles,
            run: () => router.push(`/chat?prompt=${encodeURIComponent(trimmed)}`),
          },
        ],
      });
    }

    return result;
  }, [searchQuery.data, trimmed, router]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // Any change to the result set puts the highlight back at the top, so
  // Enter never fires whatever happened to be at a stale index. Adjusted
  // during render rather than in an effect — React re-runs this component
  // before touching the DOM, so there's no flash of the wrong selection and
  // no cascading render.
  const resultsKey = `${trimmed}:${flat.map((item) => item.key).join("|")}`;
  const [selection, setSelection] = useState({ key: resultsKey, index: 0 });
  if (selection.key !== resultsKey) {
    setSelection({ key: resultsKey, index: 0 });
  }
  const active = selection.index;
  const setActive = (next: number | ((prev: number) => number)) =>
    setSelection((prev) => ({
      key: prev.key,
      index: typeof next === "function" ? next(prev.index) : next,
    }));

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const choose = (item: Item | undefined) => {
    if (!item) return;
    item.run();
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((prev) => (flat.length === 0 ? 0 : (prev + 1) % flat.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((prev) => (flat.length === 0 ? 0 : (prev - 1 + flat.length) % flat.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(flat[active]);
    }
  };

  const activeKey = flat[active]?.key;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="bg-muted hidden rounded px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          className="top-[20%] max-h-[60vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Search Clay</DialogTitle>

          <div className="flex items-center gap-2 border-b px-4">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search projects, views, tasks — or ask for a dashboard"
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={activeKey ? `${listId}-${activeKey}` : undefined}
              autoComplete="off"
              className="placeholder:text-muted-foreground flex-1 bg-transparent py-3.5 text-sm outline-none"
            />
          </div>

          <div id={listId} role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto p-2">
            {trimmed && searchQuery.isLoading && (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">Searching…</p>
            )}

            {flat.length === 0 && !searchQuery.isLoading && (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {trimmed ? "Nothing matched." : "Type to search."}
              </p>
            )}

            {groups.map((group) => (
              <div key={group.heading} className="mb-1">
                <p className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  {group.heading}
                </p>
                {group.items.map((item) => {
                  const index = flat.indexOf(item);
                  const isActive = index === active;
                  return (
                    <div
                      key={item.key}
                      id={`${listId}-${item.key}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                    >
                      <item.icon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.hint && (
                        <span className="text-muted-foreground ml-auto shrink-0 truncate text-xs">
                          {item.hint}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
