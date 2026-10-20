"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { toggleLike } from "@/lib/likesApi";
import { useToast } from "@/lib/toast";
import { HeartIcon } from "lucide-react";

interface LikeButtonProps {
  wallpaperId: string;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const LikeButton = ({
  wallpaperId,
  initialCount = 0,
  showCount = false,
  size = "md",
  className = "",
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
      className={`relative flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors duration-200 disabled:opacity-50 ${liked ? "" : "hover:bg-white/[0.08]"} ${className}`}
      style={liked
        ? { color: "#ef4444", border: "1px solid rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.12)" }
        : { color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
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

      <HeartIcon size={iconSize - 2} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} style={{
          transition: "transform 0.2s ease",
          transform: ripple ? "scale(0.85)" : "scale(1)",
        }} aria-hidden="true" />

      {showCount && (
        <span className="text-sm font-medium tabular-nums">{count}</span>
      )}
    </button>
  );
};

export default LikeButton;