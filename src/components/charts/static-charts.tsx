"use client";

import { createContext, useContext } from "react";

const StaticChartsContext = createContext(false);

// Recharts animates series on mount. That's right on screen and wrong on
// paper: a print or PDF snapshot taken mid-animation captures half-drawn
// bars. The print pages turn animation off so what gets captured is the
// finished chart.
export function StaticChartsProvider({ children }: { children: React.ReactNode }) {
  return <StaticChartsContext.Provider value={true}>{children}</StaticChartsContext.Provider>;
}

export function useChartsAnimate() {
  return !useContext(StaticChartsContext);
}
