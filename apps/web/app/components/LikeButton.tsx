"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { toggleLike } from "@/lib/likesApi";

interface LikeButtonProps {
  wallpaperId: string;
  initialLiked?: boolean;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "md";
}

const LikeButton = ({
  wallpaperId,
  initialLiked = false,
  initialCount = 0,
  showCount = false,
  size = "md",
}: LikeButtonProps) => {
  const { user, token } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || !token) {
      router.push("/login");
      return;
    }

    // optimistic update
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      setLoading(true);
      const data = await toggleLike(wallpaperId, token);
      // sync with server response
      setLiked(data.liked);
    } catch {
      // revert on error
      setLiked((prev) => !prev);
      setCount((prev) => (liked ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 18;

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className="flex items-center gap-1.5 transition-all duration-200 hover:scale-110 disabled:opacity-50"
      style={{ color: liked ? "#ef4444" : "var(--text-muted)" }}
      title={liked ? "Unlike" : "Like"}
    >
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
          transition: "all 0.2s ease",
          filter: liked ? "drop-shadow(0 0 4px rgba(239,68,68,0.5))" : "none",
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