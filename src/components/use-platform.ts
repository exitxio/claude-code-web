"use client";

import { useState, useEffect } from "react";

export function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);
  return isMac;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(navigator.maxTouchPoints > 0);
  }, []);
  return isMobile;
}

export function modKeyLabel(isMac: boolean) {
  return isMac ? "⌘" : "Ctrl+";
}
