"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { toggleLike } from "@/lib/likesApi";
import { useToast } from "@/lib/toast";

interface LikeButtonProps {
  wallpaperId: string;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "md";
}

const LikeButton = ({
  wallpaperId,
  initialCount = 0,
  showCount = false,
  size = "md",
}: LikeButtonProps) => {
  const { user, likedIds, toggleLikedId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [ripple, setRipple] = useState(false);

  // derive liked from local override or global context
  const liked = localLiked !== null ? localLiked : likedIds.has(wallpaperId);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    setRipple(true);
    setTimeout(() => setRipple(false), 600);

    const newLiked = !liked;
    setLocalLiked(newLiked);
    setCount((prev) => newLiked ? prev + 1 : prev - 1);
    toggleLikedId(wallpaperId);

    try {
      setLoading(true);
      const data = await toggleLike(wallpaperId);
      setLocalLiked(data.liked);
      if (data.liked !== newLiked) {
        toggleLikedId(wallpaperId);
      }
    } catch {
      setLocalLiked(!newLiked);
      setCount((prev) => newLiked ? prev - 1 : prev + 1);
      toggleLikedId(wallpaperId);
      toast("Failed to update like. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 20;

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={loading}
      aria-label={liked ? "Unlike wallpaper" : "Like wallpaper"}
      className="relative flex items-center gap-2 transition-all duration-200 disabled:opacity-50"
      style={{ color: liked ? "#ef4444" : "var(--text-muted)" }}
      title={liked ? "Unlike" : "Like"}
    >
      {/* ripple */}
      {ripple && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "rgba(239,68,68,0.2)",
            animation: "ripple 0.6s ease-out forwards",
          }}
        />
      )}

      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "transform 0.2s ease, filter 0.2s ease",
          transform: ripple ? "scale(0.85)" : "scale(1)",
          filter: liked ? "drop-shadow(0 0 6px rgba(239,68,68,0.5))" : "none",
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>

      {showCount && (
        <span className="text-xs font-medium tabular-nums">{count}</span>
      )}
    </button>
  );
};

export default LikeButton;