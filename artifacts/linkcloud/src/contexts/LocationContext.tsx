import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LocationState, LocationDistrict, LocationCity } from "@/lib/types";
import { seedDefaultLocations } from "@/lib/firestore";

interface LocationSearchResult {
  type: "state" | "district" | "city";
  stateName: string;
  districtName?: string;
  cityName?: string;
  displayName: string;
  matchText: string;
}

interface LocationContextType {
  states: LocationState[];
  activeStates: LocationState[];
  districts: LocationDistrict[];
  activeDistricts: LocationDistrict[];
  cities: LocationCity[];
  activeCities: LocationCity[];
  loading: boolean;
  getDistrictsForState: (stateName: string, includeDisabled?: boolean) => LocationDistrict[];
  getCitiesForDistrict: (stateName: string, districtName?: string, includeDisabled?: boolean) => LocationCity[];
  isStateEnabled: (stateName: string) => boolean;
  isDistrictEnabled: (stateName: string, districtName: string) => boolean;
  searchLocations: (query: string) => LocationSearchResult[];
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

let locationSeedTriggered = false;

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [states, setStates] = useState<LocationState[]>([]);
  const [districts, setDistricts] = useState<LocationDistrict[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || typeof db !== "object" || !("app" in db)) {
      setLoading(false);
      return;
    }

    // Trigger auto-seed on startup only once
    if (!locationSeedTriggered) {
      locationSeedTriggered = true;
      seedDefaultLocations().catch((err) => console.warn("Auto seed locations error:", err));
    }

    let isSeeding = false;

    // 1. Real-time Listener for States
    const unsubStates = onSnapshot(
      collection(db, "states"),
      (snap) => {
        if (snap.empty && !isSeeding) {
          isSeeding = true;
          seedDefaultLocations().then(() => { isSeeding = false; }).catch(() => { isSeeding = false; });
          return;
        }
        const list: LocationState[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            slug: data.slug || d.id,
            country: data.country || "India",
            enabled: data.enabled !== false && data.status !== "disabled",
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            displayOrder: data.displayOrder ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as LocationState;
        });

        list.sort((a, b) => {
          if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          }
          return a.name.localeCompare(b.name);
        });

        setStates(list);
      },
      (err) => console.warn("Firestore states snapshot error:", err)
    );

    // 2. Real-time Listener for Districts
    const unsubDistricts = onSnapshot(
      collection(db, "districts"),
      (snap) => {
        const list: LocationDistrict[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            stateId: data.stateId || "",
            stateName: data.stateName || "",
            name: data.name || "",
            slug: data.slug || d.id,
            country: data.country || "India",
            enabled: data.enabled !== false && data.status !== "disabled",
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            displayOrder: data.displayOrder ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as LocationDistrict;
        });

        list.sort((a, b) => {
          if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          }
          return a.name.localeCompare(b.name);
        });

        setDistricts(list);
      },
      (err) => console.warn("Firestore districts snapshot error:", err)
    );

    // 3. Real-time Listener for Cities
    const unsubCities = onSnapshot(
      collection(db, "cities"),
      (snap) => {
        const list: LocationCity[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            stateId: data.stateId || "",
            stateName: data.stateName || "",
            districtId: data.districtId || "",
            districtName: data.districtName || "",
            name: data.name || "",
            slug: data.slug || d.id,
            country: data.country || "India",
            enabled: data.enabled !== false && data.status !== "disabled",
            status: data.status || (data.enabled === false ? "disabled" : "active"),
            displayOrder: data.displayOrder ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy || "system",
            updatedBy: data.updatedBy || "system",
          } as LocationCity;
        });

        list.sort((a, b) => {
          if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          }
          return a.name.localeCompare(b.name);
        });

        setCities(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore cities snapshot error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubStates();
      unsubDistricts();
      unsubCities();
    };
  }, []);

  const activeStates = states.filter((s) => s.enabled !== false && s.status !== "disabled");
  const activeDistricts = districts.filter((d) => d.enabled !== false && d.status !== "disabled");
  const activeCities = cities.filter((c) => c.enabled !== false && c.status !== "disabled");

  const getDistrictsForState = (stateName: string, includeDisabled = false) => {
    if (!stateName) return [];
    const source = includeDisabled ? districts : activeDistricts;
    return source.filter((d) => d.stateName.toLowerCase().trim() === stateName.toLowerCase().trim());
  };

  const getCitiesForDistrict = (stateName: string, districtName?: string, includeDisabled = false) => {
    if (!stateName) return [];
    const source = includeDisabled ? cities : activeCities;
    return source.filter((c) => {
      const stateMatch = c.stateName.toLowerCase().trim() === stateName.toLowerCase().trim();
      if (!districtName) return stateMatch;
      return stateMatch && c.districtName.toLowerCase().trim() === districtName.toLowerCase().trim();
    });
  };

  const isStateEnabled = (stateName: string) => {
    if (!stateName) return true;
    const st = states.find((s) => s.name.toLowerCase().trim() === stateName.toLowerCase().trim());
    return st ? st.enabled !== false && st.status !== "disabled" : true;
  };

  const isDistrictEnabled = (stateName: string, districtName: string) => {
    if (!stateName || !districtName) return true;
    const dist = districts.find(
      (d) =>
        d.stateName.toLowerCase().trim() === stateName.toLowerCase().trim() &&
        d.name.toLowerCase().trim() === districtName.toLowerCase().trim()
    );
    return dist ? dist.enabled !== false && dist.status !== "disabled" : true;
  };

  const searchLocations = (query: string): LocationSearchResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: LocationSearchResult[] = [];

    // Search active states
    for (const st of activeStates) {
      if (st.name.toLowerCase().includes(q)) {
        results.push({
          type: "state",
          stateName: st.name,
          displayName: st.name,
          matchText: `${st.name} (State)`,
        });
      }
    }

    // Search active districts
    for (const dist of activeDistricts) {
      // Check if state is also enabled
      if (isStateEnabled(dist.stateName) && dist.name.toLowerCase().includes(q)) {
        results.push({
          type: "district",
          stateName: dist.stateName,
          districtName: dist.name,
          displayName: `${dist.name}, ${dist.stateName}`,
          matchText: `${dist.name} (District, ${dist.stateName})`,
        });
      }
    }

    // Search active cities
    for (const c of activeCities) {
      if (isStateEnabled(c.stateName) && c.name.toLowerCase().includes(q)) {
        results.push({
          type: "city",
          stateName: c.stateName,
          districtName: c.districtName,
          cityName: c.name,
          displayName: `${c.name}, ${c.districtName ? c.districtName + ", " : ""}${c.stateName}`,
          matchText: `${c.name} (City)`,
        });
      }
    }

    return results.slice(0, 30);
  };

  return (
    <LocationContext.Provider
      value={{
        states,
        activeStates,
        districts,
        activeDistricts,
        cities,
        activeCities,
        loading,
        getDistrictsForState,
        getCitiesForDistrict,
        isStateEnabled,
        isDistrictEnabled,
        searchLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
export default LocationContext;
