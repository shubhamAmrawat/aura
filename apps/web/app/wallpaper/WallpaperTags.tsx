interface WallpaperTagsProps {
  tags: string[];
}

const WallpaperTags = ({ tags }: WallpaperTagsProps) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-widest mb-3 text-text-muted">
        Tags
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.slice(0, 8).map((tag, i) => (
          <span
            key={i}
            className="text-xs px-3 py-1 rounded-full"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WallpaperTags;