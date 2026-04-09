"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import SaveToCollectionModal from "./SaveToCollectionModal";

interface BookmarkButtonProps {
  wallpaperId: string;
  size?: "sm" | "md";
  variant?: "card" | "detail";
}

const BookmarkButton = ({
  wallpaperId,
  size = "md",
  variant = "detail",
}: BookmarkButtonProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    setShowModal(true);
  };

  const iconSize = size === "sm" ? 13 : 18;

  if (variant === "card") {
    return (
      <>
        <button
          onClick={handleClick}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150"
          style={{
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
          }}
          title="Save to collection"
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {showModal && (
          <SaveToCollectionModal
            wallpaperId={wallpaperId}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 transition-all duration-200 hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        title="Save to collection"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {showModal && (
        <SaveToCollectionModal
          wallpaperId={wallpaperId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

export default BookmarkButton;