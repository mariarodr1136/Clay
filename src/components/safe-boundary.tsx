"use client";

import { Component, type ReactNode } from "react";

// Contains a failure to one widget of chrome instead of the whole page.
//
// The case this exists for: <OrganizationSwitcher /> needs Clerk's
// Organizations feature turned on, Clerk ships it off, and development and
// production are separate instances — so it is genuinely possible to deploy
// with it enabled locally and disabled in production. Without a boundary,
// that misconfiguration throws during render of the app shell and takes
// every page down with it. With one, the workspace switcher quietly
// disappears and the rest of Clay keeps working.
type Props = { children: ReactNode; fallback?: ReactNode; label: string };
type State = { failed: boolean };

export class SafeBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Worth a log line: a silently missing switcher is exactly the kind of
    // thing nobody notices until someone asks why they can't invite anyone.
    console.error(`[${this.props.label}] failed to render`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
