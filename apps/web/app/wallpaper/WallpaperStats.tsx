interface WallpaperStatsProps {
  width: number;
  height: number;
  format: string;
  likeCount: number;
  downloadCount: number;
  createdAt: string;
  fileSizeBytes: number;
  layout?: "row" | "grid";
}

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-widest mb-1 text-text-muted">
      {label}
    </p>
    <p className="text-sm font-mono text-text-primary">{value}</p>
  </div>
);

const Divider = () => (
  <div className="w-px h-8 bg-border hidden md:block" />
);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "Unknown";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const WallpaperStats = ({
  width,
  height,
  format,
  likeCount,
  downloadCount,
  createdAt,
  fileSizeBytes,
  layout = "row",
}: WallpaperStatsProps) => {
  if (layout === "grid") {
    return (
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 md:gap-x-5 md:gap-y-4 md:py-5 lg:py-6"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <StatItem label="Resolution" value={`${width} × ${height}`} />
        <StatItem label="Format" value={format.toUpperCase()} />
        {likeCount > 0 && <StatItem label="Likes" value={likeCount.toString()} />}
        {downloadCount > 0 && <StatItem label="Downloads" value={downloadCount.toString()} />}
        {fileSizeBytes > 0 && (
          <StatItem label="File size" value={formatFileSize(fileSizeBytes)} />
        )}
        <StatItem label="Added" value={formatDate(createdAt)} />
      </div>
    );
  }

  // Counts appear once they are above zero — a row of zeros reads as an inactive site.
  const items: [string, string][] = [
    ["Resolution", `${width} × ${height}`],
    ["Format", format.toUpperCase()],
    ...(likeCount > 0 ? [["Likes", likeCount.toString()] as [string, string]] : []),
    ...(downloadCount > 0 ? [["Downloads", downloadCount.toString()] as [string, string]] : []),
    ...(fileSizeBytes > 0 ? [["File size", formatFileSize(fileSizeBytes)] as [string, string]] : []),
    ["Added", formatDate(createdAt)],
  ];

  return (
    <div className="flex flex-wrap items-center gap-6 mt-6">
      {items.map(([label, value], i) => (
        <div key={label} className="contents">
          {i > 0 && <Divider />}
          <StatItem label={label} value={value} />
        </div>
      ))}
    </div>
  );
};

export default WallpaperStats;