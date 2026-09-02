"use client";

import { useCallback, useEffect, useState } from "react";

const BOOT_DELAY_MS = 2200;

export function useBootSequence() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), BOOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const bootNow = useCallback(() => setBooted(true), []);

  return { booted, bootNow };
}
