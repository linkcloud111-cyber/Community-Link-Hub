import { Link } from "wouter";
import { Heart, ExternalLink, Trash2, Users, Layers } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import type { Group } from "@/lib/types";

interface FavoritesTabProps {
  favorites: Group[];
  onRemoveFavorite: (id: string) => void;
}

export function FavoritesTab({ favorites, onRemoveFavorite }: FavoritesTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 dark:text-pink-400 flex-shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Saved Favorites</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct shortcuts to your bookmarked groups and communities
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
          {favorites.length} Saved
        </span>
      </div>

      {/* Grid */}
      {favorites.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400 mx-auto flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No favorites saved yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Explore the LinkCloud directory and click the heart icon on any group card to bookmark it here for quick access.
            </p>
          </div>
          <Link
            href="/groups"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Explore Groups Directory</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((group) => (
            <div
              key={group.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {group.logoUrl ? (
                      <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PlatformIcon platform={group.platform} className="w-6 h-6 text-purple-600" />
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveFavorite(group.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition"
                    title="Remove from favorites"
                    aria-label="Remove from favorites"
                  >
                    <Heart className="w-5 h-5 fill-current text-pink-500" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {group.platform}
                    </span>
                    <span>•</span>
                    <span>{group.categoryName || "General"}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {group.description || "No description provided."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  {group.memberCount ? `${group.memberCount} members` : "Community"}
                </span>

                <Link
                  href={`/groups/${group.id}`}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 transition"
                >
                  <span>View Group</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
