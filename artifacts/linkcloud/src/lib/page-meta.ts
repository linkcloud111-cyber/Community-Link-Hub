import { useEffect } from "react";

export function usePageTitle(title: string, subtitle?: string) {
  useEffect(() => {
    const fullTitle = title.includes("LinkCloud")
      ? title
      : subtitle
      ? `${title} — ${subtitle} | LinkCloud`
      : `${title} — LinkCloud`;
    document.title = fullTitle;
  }, [title, subtitle]);
}
