"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

type Bookmark = {
  id: string;
  url: string;
  title: string;
  created_at: string;
  user_id: string;
};

// ✅ Single instance outside component — prevents new WebSocket on every render
const supabase = createClient();

export default function BookmarkList({ user }: { user: User }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBookmarks(data);
    }
    setLoading(false);
  }, [user.id]);

  // Realtime: Supabase postgres_changes + BroadcastChannel fallback
  useEffect(() => {
    fetchBookmarks();

    // Supabase Realtime (cross-device sync)
    const channel = supabase
      .channel(`bookmarks-${user.id}`) // ✅ unique channel name per user
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`, // ✅ server-side filter, not client-side
        },
        (payload) => {
          const newBookmark = payload.new as Bookmark;
          setBookmarks((prev) => {
            if (prev.find((b) => b.id === newBookmark.id)) return prev;
            return [newBookmark, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`, // ✅ server-side filter
        },
        (payload) => {
          setBookmarks((prev) =>
            prev.filter((b) => b.id !== payload.old.id)
          );
        }
      )
      .subscribe((status, err) => {
        console.log("Supabase Realtime status:", status);
        if (err) console.error("Supabase Realtime error:", err);
      });

    // BroadcastChannel fallback (same-browser cross-tab sync)
    const bc = new BroadcastChannel(`bookmarks-${user.id}`);
    bc.onmessage = (event) => {
      const { type, bookmark, id } = event.data;
      if (type === "added") {
        setBookmarks((prev) => {
          if (prev.find((b) => b.id === bookmark.id)) return prev;
          return [bookmark, ...prev];
        });
      } else if (type === "deleted") {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    };

    return () => {
      supabase.removeChannel(channel);
      bc.close();
    };
  }, [user.id, fetchBookmarks]);

  const broadcast = (message: { type: string; bookmark?: Bookmark; id?: string }) => {
    const bc = new BroadcastChannel(`bookmarks-${user.id}`);
    bc.postMessage(message);
    bc.close();
  };

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;

    setIsAdding(true);

    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        url: finalUrl,
        title: title.trim(),
        user_id: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setBookmarks((prev) => {
        if (prev.find((b) => b.id === data.id)) return prev;
        return [data, ...prev];
      });
      broadcast({ type: "added", bookmark: data });
      setUrl("");
      setTitle("");
      setShowForm(false);
    }

    setIsAdding(false);
  };

  const deleteBookmark = async (id: string) => {
    setDeletingId(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    broadcast({ type: "deleted", id });
    await supabase.from("bookmarks").delete().eq("id", id);
    setDeletingId(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cream/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                />
              </svg>
            </div>
            <h1 className="font-display text-xl text-ink">Markly</h1>
          </div>

          <div className="flex items-center gap-3">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-7 h-7 rounded-full ring-2 ring-border"
              />
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-muted hover:text-ink transition-colors font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome + Add button */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-muted text-sm mb-1">
              Welcome back,{" "}
              {user.user_metadata?.full_name?.split(" ")[0] || "there"}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-ink">
              Your Bookmarks
            </h2>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              showForm
                ? "bg-ink/5 text-ink"
                : "bg-accent text-white shadow-sm shadow-accent/25 hover:shadow-md hover:shadow-accent/30"
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${showForm ? "rotate-45" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            {showForm ? "Cancel" : "Add bookmark"}
          </button>
        </div>

        {/* Add bookmark form */}
        {showForm && (
          <div className="animate-scale-in mb-8 bg-surface rounded-2xl border border-border p-5 shadow-sm">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My favorite article"
                  className="w-full px-4 py-3 rounded-xl bg-cream/60 border border-border text-ink placeholder:text-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 rounded-xl bg-cream/60 border border-border text-ink placeholder:text-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addBookmark(e);
                  }}
                />
              </div>
              <button
                onClick={addBookmark}
                disabled={isAdding || !url.trim() || !title.trim()}
                className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-accent/20"
              >
                {isAdding ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save bookmark"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Bookmark list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <svg
              className="w-6 h-6 animate-spin mb-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm">Loading bookmarks...</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="animate-fade-in text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-accent/40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                />
              </svg>
            </div>
            <p className="text-muted text-lg mb-1">No bookmarks yet</p>
            <p className="text-muted/60 text-sm">
              Click &ldquo;Add bookmark&rdquo; to save your first link
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((bookmark, index) => (
              <div
                key={bookmark.id}
                className="animate-slide-up group bg-surface rounded-xl border border-border hover:border-accent/20 hover:shadow-sm transition-all duration-200 px-4 py-3.5"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  {/* Favicon */}
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-cream flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {getFaviconUrl(bookmark.url) ? (
                      <img
                        src={getFaviconUrl(bookmark.url)!}
                        alt=""
                        className="w-4 h-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <svg
                        className="w-4 h-4 text-muted/40"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-ink text-[15px] truncate">
                      {bookmark.title}
                    </h3>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted hover:text-accent transition-colors truncate block mt-0.5"
                    >
                      {bookmark.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>

                  {/* Time + Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted/50 hidden sm:block">
                      {formatDate(bookmark.created_at)}
                    </span>
                    <button
                      onClick={() => deleteBookmark(bookmark.id)}
                      disabled={deletingId === bookmark.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-all duration-200"
                      title="Delete bookmark"
                    >
                      {deletingId === bookmark.id ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pb-8 text-center">
          <p className="text-muted/40 text-xs">
            {bookmarks.length > 0 &&
              `${bookmarks.length} bookmark${bookmarks.length !== 1 ? "s" : ""} saved`}
          </p>
        </div>
      </main>
    </div>
  );
}
