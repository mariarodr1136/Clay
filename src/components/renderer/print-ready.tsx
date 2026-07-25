"use client";

import { useEffect, useState } from "react";

// Charts size themselves from the DOM after hydration, so "the document
// loaded" isn't the same as "the charts are drawn". This flips only once the
// browser has laid out and painted a frame containing them, giving the PDF
// renderer something concrete to wait for instead of a guessed delay.
export function PrintReadyMarker() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf = 0;
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    }, 120);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div hidden data-print-ready={ready ? "true" : "false"} />;
}
