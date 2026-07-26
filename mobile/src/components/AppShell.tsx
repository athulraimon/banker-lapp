import React from 'react';

// On native the app already fills the device, so the shell is a passthrough.
// The web build resolves AppShell.web.tsx, which constrains the layout to a
// phone-width column so the design isn't stretched across a desktop monitor.
export function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
