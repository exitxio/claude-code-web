"use client";

import { useState, useEffect } from "react";

const TICK_INTERVAL_MS = 100;

export function ElapsedTimer({ className }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{(elapsed / 1000).toFixed(1)}s</span>;
}
