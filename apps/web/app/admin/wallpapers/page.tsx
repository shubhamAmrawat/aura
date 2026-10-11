import { Suspense } from "react";
import WallpapersManager from "./WallpapersManager";

export default function AdminWallpapersPage() {
  return (
    <Suspense fallback={null}>
      <WallpapersManager />
    </Suspense>
  );
}
