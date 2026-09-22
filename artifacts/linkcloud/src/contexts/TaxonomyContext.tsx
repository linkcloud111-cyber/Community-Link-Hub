import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category, PlatformItem, ContentTypeItem, LanguageItem } from "@/lib/types";
import { slugify } from "@/lib/firestore";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PLATFORMS,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_LANGUAGES,
} from "@/lib/default-taxonomies";
import {
  getCategoryVisual,
  getPlatformVisual,
  getContentTypeVisual,
  getLanguageVisual,
} from "@/lib/taxonomy-visuals";

interface TaxonomyContextType {
  categories: Category[];
  activeCategories: Category[];
  platforms: PlatformItem[];
  activePlatforms: PlatformItem[];
  contentTypes: ContentTypeItem[];
  activeContentTypes: ContentTypeItem[];
  languages: LanguageItem[];
  activeLanguages: LanguageItem[];
  loading: boolean;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryByName: (name: string) => Category | undefined;
  getPlatformByName: (name: string) => PlatformItem | undefined;
}

const TaxonomyContext = createContext<TaxonomyContextType | undefined>(undefined);

export function TaxonomyProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [platforms, setPlatforms] = useState<PlatformItem[]>(DEFAULT_PLATFORMS);
  const [contentTypes, setContentTypes] = useState<ContentTypeItem[]>(DEFAULT_CONTENT_TYPES);
  const [languages, setLanguages] = useState<LanguageItem[]>(DEFAULT_LANGUAGES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db || typeof db !== "object" || !("app" in db)) {
      setLoading(false);
      return;
    }

    // Real-time listener for Categories
    const unsubCats = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        if (snap.empty) {
          setCategories((prev) => (prev.length > 0 ? prev : DEFAULT_CATEGORIES));
          return;
        }
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data();
          const visual = getCategoryVisual(data.name, data.themeColor || data.color, data.icon);
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || slugify(data.name || ""),
            icon: data.icon || visual.iconName,
            color: visual.color,
            themeColor: visual.color,
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            enabled: data.enabled !== false && data.status !== "disabled",
            displayOrder: data.displayOrder ?? data.order ?? 0,
            groupCount: data.groupCount ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as Category;
        });

        list.sort((a, b) => {
          if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          }
          return a.name.localeCompare(b.name);
        });

        setCategories(list);
      },
      (err) => console.warn("Firestore categories snapshot error:", err)
    );

    // Real-time listener for Platforms
    const unsubPlats = onSnapshot(
      collection(db, "platforms"),
      (snap) => {
        if (snap.empty) {
          setPlatforms((prev) => (prev.length > 0 ? prev : DEFAULT_PLATFORMS));
          return;
        }
        const list: PlatformItem[] = snap.docs.map((d) => {
          const data = d.data();
          const visual = getPlatformVisual(data.name, data.themeColor || data.color, data.icon);
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || slugify(data.name || ""),
            icon: data.icon || visual.iconName,
            color: visual.color,
            themeColor: visual.color,
            badgeColor: data.badgeColor || "bg-primary/10 text-primary border-primary/20",
            iconUrl: data.iconUrl || "",
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            enabled: data.enabled !== false && data.status !== "disabled",
            displayOrder: data.displayOrder ?? data.order ?? 0,
            order: data.order ?? data.displayOrder ?? 0,
            invitePattern: data.invitePattern || "",
            helpText: data.helpText || "",
            errorText: data.errorText || "",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as PlatformItem;
        });

        list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setPlatforms(list);
      },
      (err) => console.warn("Firestore platforms snapshot error:", err)
    );

    // Real-time listener for Content Types
    const unsubCts = onSnapshot(
      collection(db, "contentTypes"),
      (snap) => {
        if (snap.empty) {
          setContentTypes((prev) => (prev.length > 0 ? prev : DEFAULT_CONTENT_TYPES));
          return;
        }
        const list: ContentTypeItem[] = snap.docs.map((d) => {
          const data = d.data();
          const visual = getContentTypeVisual(data.name, data.themeColor || data.color, data.icon);
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || slugify(data.name || ""),
            icon: data.icon || visual.iconName,
            color: visual.color,
            themeColor: visual.color,
            categoryId: data.categoryId || "",
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            enabled: data.enabled !== false && data.status !== "disabled",
            displayOrder: data.displayOrder ?? data.order ?? 0,
            order: data.order ?? data.displayOrder ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as ContentTypeItem;
        });

        list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setContentTypes(list);
      },
      (err) => console.warn("Firestore contentTypes snapshot error:", err)
    );

    // Real-time listener for Languages
    const unsubLangs = onSnapshot(
      collection(db, "languages"),
      (snap) => {
        if (snap.empty) {
          setLanguages((prev) => (prev.length > 0 ? prev : DEFAULT_LANGUAGES));
          setLoading(false);
          return;
        }
        const list: LanguageItem[] = snap.docs.map((d) => {
          const data = d.data();
          const visual = getLanguageVisual(data.name, data.themeColor || data.color, data.icon);
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || slugify(data.name || ""),
            code: data.code || "",
            icon: data.icon || visual.iconName,
            color: visual.color,
            themeColor: visual.color,
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            enabled: data.enabled !== false && data.status !== "disabled",
            displayOrder: data.displayOrder ?? data.order ?? 0,
            order: data.order ?? data.displayOrder ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as LanguageItem;
        });

        list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setLanguages(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore languages snapshot error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubCats();
      unsubPlats();
      unsubCts();
      unsubLangs();
    };
  }, []);

  const activeCategories = categories.filter((c) => c.status === "active" && c.enabled !== false);
  const activePlatforms = platforms.filter((p) => p.status === "active" && p.enabled !== false);
  const activeContentTypes = contentTypes.filter((ct) => ct.status === "active" && ct.enabled !== false);
  const activeLanguages = languages.filter((l) => l.status === "active" && l.enabled !== false);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);
  const getCategoryByName = (name: string) =>
    categories.find((c) => c.name.toLowerCase().trim() === name.toLowerCase().trim());
  const getPlatformByName = (name: string) =>
    platforms.find((p) => p.name.toLowerCase().trim() === name.toLowerCase().trim());

  return (
    <TaxonomyContext.Provider
      value={{
        categories,
        activeCategories,
        platforms,
        activePlatforms,
        contentTypes,
        activeContentTypes,
        languages,
        activeLanguages,
        loading,
        getCategoryById,
        getCategoryByName,
        getPlatformByName,
      }}
    >
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomy() {
  const context = useContext(TaxonomyContext);
  if (!context) {
    throw new Error("useTaxonomy must be used within a TaxonomyProvider");
  }
  return context;
}
