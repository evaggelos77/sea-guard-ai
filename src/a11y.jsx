import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// Στρώμα προσβασιμότητας: υψηλή αντίθεση (χαμηλή όραση), μέγεθος γραμμάτων Α+/Α−, «Διάβασέ μου» (TTS).
const A11yContext = createContext({
  contrast: false,
  toggleContrast: () => {},
  scale: 1,
  bumpScale: () => {},
  speak: () => {},
  stopSpeak: () => {},
  speaking: false,
});

const SCALES = [1, 1.15, 1.3];

export function A11yProvider({ children }) {
  const [contrast, setContrast] = useState(() => {
    try {
      return localStorage.getItem("sg-contrast") === "1";
    } catch {
      return false;
    }
  });
  const [scale, setScale] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem("sg-scale"));
      return SCALES.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (contrast) root.setAttribute("data-contrast", "on");
      else root.removeAttribute("data-contrast");
      localStorage.setItem("sg-contrast", contrast ? "1" : "0");
    } catch {}
  }, [contrast]);

  useEffect(() => {
    try {
      document.documentElement.style.setProperty("--ui-scale", String(scale));
      localStorage.setItem("sg-scale", String(scale));
    } catch {}
  }, [scale]);

  const toggleContrast = useCallback(() => setContrast((v) => !v), []);

  const bumpScale = useCallback((dir) => {
    setScale((s) => {
      const i = SCALES.indexOf(s);
      const ni = Math.max(0, Math.min(SCALES.length - 1, (i < 0 ? 0 : i) + dir));
      return SCALES[ni];
    });
  }, []);

  const speak = useCallback((text, lang) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = lang === "en" ? "en-GB" : "el-GR";
      u.rate = 0.98;
      u.pitch = 1;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stopSpeak = useCallback(() => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {}
    setSpeaking(false);
  }, []);

  return (
    <A11yContext.Provider value={{ contrast, toggleContrast, scale, bumpScale, speak, stopSpeak, speaking }}>
      {children}
    </A11yContext.Provider>
  );
}

export const useA11y = () => useContext(A11yContext);
