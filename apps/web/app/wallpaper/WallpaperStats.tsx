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
        className="grid grid-cols-2 gap-6 py-8"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <StatItem label="Resolution" value={`${width} × ${height}`} />
        <StatItem label="Format" value={format.toUpperCase()} />
        <StatItem label="Likes" value={likeCount.toString()} />
        <StatItem label="Downloads" value={downloadCount.toString()} />
        {fileSizeBytes > 0 && (
          <StatItem label="File size" value={formatFileSize(fileSizeBytes)} />
        )}
        <StatItem label="Added" value={formatDate(createdAt)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6 mt-6">
      <StatItem label="Resolution" value={`${width} × ${height}`} />
      <Divider />
      <StatItem label="Format" value={format.toUpperCase()} />
      <Divider />
      <StatItem label="Likes" value={likeCount.toString()} />
      <Divider />
      <StatItem label="Downloads" value={downloadCount.toString()} />
      {fileSizeBytes > 0 && (
        <>
          <Divider />
          <StatItem label="File size" value={formatFileSize(fileSizeBytes)} />
        </>
      )}
      <Divider />
      <StatItem label="Added" value={formatDate(createdAt)} />
    </div>
  );
};

export default WallpaperStats;