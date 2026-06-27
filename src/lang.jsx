import React, { createContext, useContext, useEffect, useState } from "react";

// Απλό δίγλωσσο σύστημα: t("Ελληνικό", "English") → επιστρέφει ανάλογα με τη γλώσσα.
const LangContext = createContext({ lang: "el", setLang: () => {}, t: (el) => el });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("sg-lang") || "el";
    } catch {
      return "el";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("sg-lang", lang);
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);
  const t = (el, en) => (lang === "en" ? (en === undefined ? el : en) : el);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
