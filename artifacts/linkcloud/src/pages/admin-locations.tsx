import { useState, useEffect } from "react";
import AdminNav from "@/components/admin-nav";
import { toast } from "sonner";
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Edit2,
  Trash2,
  Power,
  AlertTriangle,
  X,
  Loader2,
  Building,
  RefreshCw,
} from "lucide-react";
import {
  getAllLocationStates,
  getDistrictsForStateFirestore,
  getCitiesForLocationFirestore,
  addStateFirestore,
  toggleStateFirestore,
  updateStateFirestore,
  deleteStateFirestore,
  addDistrictFirestore,
  toggleDistrictFirestore,
  updateDistrictFirestore,
  deleteDistrictFirestore,
  addCityFirestore,
  toggleCityFirestore,
  updateCityFirestore,
  deleteCityFirestore,
  getGroupsCountForLocation,
  seedDefaultLocations,
} from "@/lib/firestore";
import type { LocationState, LocationDistrict, LocationCity } from "@/lib/types";

export default function AdminLocations() {
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<LocationState[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedState, setExpandedState] = useState<string | null>(null);

  // Loaded map for districts and cities per state
  const [districtsMap, setDistrictsMap] = useState<Record<string, LocationDistrict[]>>({});
  const [citiesMap, setCitiesMap] = useState<Record<string, LocationCity[]>>({});

  // Modals state
  const [addStateOpen, setAddStateOpen] = useState(false);
  const [newStateName, setNewStateName] = useState("");

  const [editStateItem, setEditStateItem] = useState<LocationState | null>(null);
  const [editStateName, setEditStateName] = useState("");

  const [addDistrictState, setAddDistrictState] = useState<string | null>(null);
  const [newDistrictName, setNewDistrictName] = useState("");

  const [editDistrictItem, setEditDistrictItem] = useState<LocationDistrict | null>(null);
  const [editDistrictName, setEditDistrictName] = useState("");

  const [addCityContext, setAddCityContext] = useState<{ stateName: string; districtName: string } | null>(null);
  const [newCityName, setNewCityName] = useState("");

  const [editCityItem, setEditCityItem] = useState<LocationCity | null>(null);
  const [editCityName, setEditCityName] = useState("");

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "state" | "district" | "city";
    item: LocationState | LocationDistrict | LocationCity;
    groupCount: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncingDefaults, setSyncingDefaults] = useState(false);

  // Re-sync Default Indian States & Districts
  const handleSyncDefaults = async () => {
    setSyncingDefaults(true);
    try {
      toast.info("Verifying & installing default India location records...");
      const res = await seedDefaultLocations();
      if (res.success) {
        if (res.statesAdded > 0 || res.districtsAdded > 0) {
          toast.success(`Sync complete! Added: ${res.statesAdded} States/UTs, ${res.districtsAdded} Districts. Skipped: ${res.skipped}.`);
        } else {
          toast.success("India location database is already synchronized.");
        }
      } else {
        toast.error(`Sync failed: ${res.message}`);
      }
      await loadStates();
    } catch (err: any) {
      toast.error(`Failed to sync default location records: ${err?.message || err}`);
    } finally {
      setSyncingDefaults(false);
    }
  };

  // Load States from Firestore
  const loadStates = async () => {
    setLoading(true);
    try {
      const data = await getAllLocationStates(true);
      setStates(data);
    } catch {
      toast.error("Failed to load states from Firestore");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  // Expand state & load its districts & cities from Firestore
  const handleToggleExpand = async (stateName: string) => {
    if (expandedState === stateName) {
      setExpandedState(null);
      return;
    }

    setExpandedState(stateName);
    try {
      const [dists, cits] = await Promise.all([
        getDistrictsForStateFirestore(stateName, true),
        getCitiesForLocationFirestore(stateName, undefined, true),
      ]);
      setDistrictsMap((prev) => ({ ...prev, [stateName]: dists }));
      setCitiesMap((prev) => ({ ...prev, [stateName]: cits }));
    } catch {
      toast.error(`Failed to load districts & cities for ${stateName}`);
    }
  };

  // Reload districts and cities for expanded state
  const reloadStateDetails = async (stateName: string) => {
    try {
      const [dists, cits] = await Promise.all([
        getDistrictsForStateFirestore(stateName, true),
        getCitiesForLocationFirestore(stateName, undefined, true),
      ]);
      setDistrictsMap((prev) => ({ ...prev, [stateName]: dists }));
      setCitiesMap((prev) => ({ ...prev, [stateName]: cits }));
    } catch (e) {
      console.warn("Reload failed", e);
    }
  };

  // ─── STATE HANDLERS ───

  const handleAddState = async () => {
    if (!newStateName.trim()) {
      toast.error("State name is required.");
      return;
    }
    try {
      await addStateFirestore(newStateName.trim());
      toast.success(`State "${newStateName.trim()}" added to Firestore`);
      setNewStateName("");
      setAddStateOpen(false);
      await loadStates();
    } catch {
      toast.error("Failed to add state");
    }
  };

  const handleToggleState = async (st: LocationState) => {
    try {
      const newStatus = !st.enabled;
      await toggleStateFirestore(st.id, st.name, newStatus);
      toast.success(newStatus ? `State "${st.name}" enabled` : `State "${st.name}" disabled`);
      setStates((prev) => prev.map((item) => (item.id === st.id ? { ...item, enabled: newStatus } : item)));
    } catch {
      toast.error("Failed to update state status");
    }
  };

  const handleSaveEditState = async () => {
    if (!editStateItem || !editStateName.trim()) return;
    try {
      await updateStateFirestore(editStateItem.id, editStateName.trim(), editStateItem.enabled);
      toast.success(`State updated to "${editStateName.trim()}"`);
      setEditStateItem(null);
      await loadStates();
    } catch {
      toast.error("Failed to update state");
    }
  };

  const promptDeleteState = async (st: LocationState) => {
    const count = await getGroupsCountForLocation(st.name);
    setDeleteTarget({ type: "state", item: st, groupCount: count });
  };

  // ─── DISTRICT HANDLERS ───

  const handleAddDistrict = async () => {
    if (!addDistrictState || !newDistrictName.trim()) return;
    try {
      await addDistrictFirestore(addDistrictState, newDistrictName.trim());
      toast.success(`District "${newDistrictName.trim()}" added to ${addDistrictState}`);
      setNewDistrictName("");
      setAddDistrictState(null);
      await reloadStateDetails(addDistrictState);
    } catch {
      toast.error("Failed to add district");
    }
  };

  const handleToggleDistrict = async (d: LocationDistrict) => {
    try {
      const newStatus = !d.enabled;
      await toggleDistrictFirestore(d.id, d.stateName, d.name, newStatus);
      toast.success(newStatus ? `District "${d.name}" enabled` : `District "${d.name}" disabled`);
      await reloadStateDetails(d.stateName);
    } catch {
      toast.error("Failed to update district status");
    }
  };

  const handleSaveEditDistrict = async () => {
    if (!editDistrictItem || !editDistrictName.trim()) return;
    try {
      await updateDistrictFirestore(editDistrictItem.id, editDistrictName.trim(), editDistrictItem.enabled);
      toast.success(`District updated to "${editDistrictName.trim()}"`);
      const stateName = editDistrictItem.stateName;
      setEditDistrictItem(null);
      await reloadStateDetails(stateName);
    } catch {
      toast.error("Failed to update district");
    }
  };

  const promptDeleteDistrict = async (d: LocationDistrict) => {
    const count = await getGroupsCountForLocation(undefined, d.name);
    setDeleteTarget({ type: "district", item: d, groupCount: count });
  };

  // ─── CITY HANDLERS ───

  const handleAddCity = async () => {
    if (!addCityContext || !newCityName.trim()) return;
    try {
      await addCityFirestore(addCityContext.stateName, addCityContext.districtName, newCityName.trim());
      toast.success(`City "${newCityName.trim()}" added to ${addCityContext.stateName}`);
      setNewCityName("");
      const stName = addCityContext.stateName;
      setAddCityContext(null);
      await reloadStateDetails(stName);
    } catch {
      toast.error("Failed to add city");
    }
  };

  const handleToggleCity = async (c: LocationCity) => {
    try {
      const newStatus = !c.enabled;
      await toggleCityFirestore(c.id, c.name, newStatus);
      toast.success(newStatus ? `City "${c.name}" enabled` : `City "${c.name}" disabled`);
      await reloadStateDetails(c.stateName);
    } catch {
      toast.error("Failed to update city status");
    }
  };

  const handleSaveEditCity = async () => {
    if (!editCityItem || !editCityName.trim()) return;
    try {
      await updateCityFirestore(editCityItem.id, editCityName.trim(), editCityItem.enabled);
      toast.success(`City updated to "${editCityName.trim()}"`);
      const stateName = editCityItem.stateName;
      setEditCityItem(null);
      await reloadStateDetails(stateName);
    } catch {
      toast.error("Failed to update city");
    }
  };

  const promptDeleteCity = async (c: LocationCity) => {
    const count = await getGroupsCountForLocation(undefined, undefined, c.name);
    setDeleteTarget({ type: "city", item: c, groupCount: count });
  };

  // ─── CONFIRM DELETE ───

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.groupCount > 0) {
      toast.error(`This location is being used by ${deleteTarget.groupCount} existing group(s) and cannot be safely deleted. Please disable it instead.`);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      if (deleteTarget.type === "state") {
        const st = deleteTarget.item as LocationState;
        await deleteStateFirestore(st.id, st.name);
        toast.success(`State "${st.name}" deleted from Firestore`);
        await loadStates();
      } else if (deleteTarget.type === "district") {
        const dist = deleteTarget.item as LocationDistrict;
        await deleteDistrictFirestore(dist.id, dist.name, dist.stateName);
        toast.success(`District "${dist.name}" deleted from Firestore`);
        await reloadStateDetails(dist.stateName);
      } else {
        const city = deleteTarget.item as LocationCity;
        await deleteCityFirestore(city.id, city.name);
        toast.success(`City "${city.name}" deleted from Firestore`);
        await reloadStateDetails(city.stateName);
      }
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete location");
    } finally {
      setDeleting(false);
    }
  };

  const filteredStates = states.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const disabledCount = states.filter((s) => !s.enabled).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" /> Firestore Location Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dynamic Firestore States, Districts & Cities. Add, edit, enable, disable, or safely delete locations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleSyncDefaults}
            disabled={syncingDefaults}
            className="px-4 py-2.5 bg-muted text-foreground border border-border font-bold rounded-2xl text-xs flex items-center gap-2 hover:bg-muted/80 transition-colors shadow-sm disabled:opacity-50"
            title="Auto-seed missing official Indian states & districts to Firestore (Idempotent)"
          >
            {syncingDefaults ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <RefreshCw className="w-4 h-4 text-primary" />
            )}
            Sync Default India Database
          </button>

          <button
            onClick={() => setAddStateOpen(true)}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-2xl text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" /> Add New State
          </button>
        </div>
      </div>

      {/* Admin Nav */}
      <AdminNav />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Total States & UTs</p>
          <p className="text-3xl font-extrabold">{states.length}</p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Active Enabled States</p>
          <p className="text-3xl font-extrabold text-emerald-600">
            {states.filter((s) => s.enabled).length}
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Disabled States</p>
          <p className="text-3xl font-extrabold text-destructive">{disabledCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search states in Firestore..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Main Accordion List */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground">Syncing locations from Firestore...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStates.map((st) => {
            const isOpen = expandedState === st.name;
            const dists = districtsMap[st.name] || [];
            const cities = citiesMap[st.name] || [];

            return (
              <div
                key={st.id}
                className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                  !st.enabled ? "border-destructive/30 bg-destructive/5" : "border-border"
                }`}
              >
                {/* State Item Bar */}
                <div className="flex items-center justify-between p-4 bg-muted/20">
                  <button
                    onClick={() => handleToggleExpand(st.name)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <MapPin className={`w-4 h-4 ${!st.enabled ? "text-destructive" : "text-primary"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{st.name}</p>
                        {!st.enabled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-destructive/10 text-destructive uppercase">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Click to view districts & custom cities in Firestore
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleState(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                        !st.enabled
                          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                      }`}
                      title={st.enabled ? "Disable State from Public View" : "Enable State for Public View"}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {st.enabled ? "Disable" : "Enable"}
                    </button>

                    {/* Edit State */}
                    <button
                      onClick={() => {
                        setEditStateItem(st);
                        setEditStateName(st.name);
                      }}
                      className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                      title="Edit State Name"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete State */}
                    <button
                      onClick={() => promptDeleteState(st)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                      title="Delete State"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleExpand(st.name)}
                      className="p-1.5 hover:bg-muted rounded-lg"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && (
                  <div className="p-5 border-t border-border space-y-6 bg-card">
                    {/* Districts Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-primary" /> Districts in {st.name} ({dists.length})
                        </p>
                        <button
                          onClick={() => {
                            setAddDistrictState(st.name);
                            setNewDistrictName("");
                          }}
                          className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add District
                        </button>
                      </div>

                      {dists.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No districts loaded in Firestore yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dists.map((d) => (
                            <div
                              key={d.id}
                              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-colors ${
                                !d.enabled
                                  ? "bg-destructive/5 border-destructive/30 text-destructive line-through"
                                  : "bg-muted/40 border-border text-foreground"
                              }`}
                            >
                              <span className="font-medium">{d.name}</span>

                              <div className="flex items-center gap-1 ml-1 border-l border-border pl-1.5">
                                <button
                                  onClick={() => handleToggleDistrict(d)}
                                  className="p-0.5 hover:text-primary"
                                  title={d.enabled ? "Disable District" : "Enable District"}
                                >
                                  <Power className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditDistrictItem(d);
                                    setEditDistrictName(d.name);
                                  }}
                                  className="p-0.5 hover:text-primary"
                                  title="Edit District"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => promptDeleteDistrict(d)}
                                  className="p-0.5 hover:text-destructive"
                                  title="Delete District"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cities Section */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" /> Tier-2/3 Cities & Localities ({cities.length})
                        </p>
                        <button
                          onClick={() => {
                            setAddCityContext({ stateName: st.name, districtName: "" });
                            setNewCityName("");
                          }}
                          className="px-2.5 py-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add City
                        </button>
                      </div>

                      {cities.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No custom cities added for {st.name} yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {cities.map((c) => (
                            <div
                              key={c.id}
                              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs ${
                                !c.enabled
                                  ? "bg-destructive/5 border-destructive/30 text-destructive line-through"
                                  : "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              <span className="font-bold">{c.name}</span>
                              <div className="flex items-center gap-1 ml-1 border-l border-border pl-1.5">
                                <button onClick={() => handleToggleCity(c)} className="p-0.5 hover:text-primary">
                                  <Power className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditCityItem(c);
                                    setEditCityName(c.name);
                                  }}
                                  className="p-0.5 hover:text-primary"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => promptDeleteCity(c)} className="p-0.5 hover:text-destructive">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add State */}
      {addStateOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Add New State to Firestore</h2>
              <button onClick={() => setAddStateOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">State / UT Name</label>
              <input
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                placeholder="e.g. Telangana, Goa"
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAddStateOpen(false)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleAddState} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Save to Firestore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit State */}
      {editStateItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Edit State Name</h2>
              <button onClick={() => setEditStateItem(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">State Name</label>
              <input
                value={editStateName}
                onChange={(e) => setEditStateName(e.target.value)}
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditStateItem(null)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveEditState} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Update State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add District */}
      {addDistrictState && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Add District to {addDistrictState}</h2>
              <button onClick={() => setAddDistrictState(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">District Name</label>
              <input
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                placeholder="e.g. Cyberabad, North Goa"
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAddDistrictState(null)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleAddDistrict} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Add District
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit District */}
      {editDistrictItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Edit District Name</h2>
              <button onClick={() => setEditDistrictItem(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">District Name</label>
              <input
                value={editDistrictName}
                onChange={(e) => setEditDistrictName(e.target.value)}
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditDistrictItem(null)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveEditDistrict} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Update District
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add City */}
      {addCityContext && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Add City to {addCityContext.stateName}</h2>
              <button onClick={() => setAddCityContext(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">City / Locality Name</label>
              <input
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                placeholder="e.g. Whitefield, Bandra, HSR Layout"
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAddCityContext(null)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleAddCity} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Add City
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit City */}
      {editCityItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Edit City Name</h2>
              <button onClick={() => setEditCityItem(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">City Name</label>
              <input
                value={editCityName}
                onChange={(e) => setEditCityName(e.target.value)}
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditCityItem(null)} className="px-4 py-2 bg-muted text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveEditCity} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">
                Update City
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation Safety */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-destructive border-b border-border pb-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-base font-bold">Confirm Delete Location</h2>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Are you sure you want to permanently delete the {deleteTarget.type}{" "}
                <strong className="text-foreground">{deleteTarget.item.name}</strong> from Firestore?
              </p>

              {deleteTarget.groupCount > 0 ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-semibold">
                  ⚠️ Warning: This location is currently associated with{" "}
                  <strong>{deleteTarget.groupCount} group(s)</strong> in Firestore. Deleting it will disassociate or create unreferenced groups.
                </div>
              ) : (
                <p className="text-emerald-600 font-medium">
                  ✓ Safe to delete: No active groups are currently using this location.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 bg-muted text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
