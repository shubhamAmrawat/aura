import { createContext, ReactNode, useContext, useMemo } from "react";
import { useLayoutInfo } from "../hooks/useLayout";

export type ScreenFilter = "mobile" | "tablet";

type ScreenFilterContextType = {
  screen: ScreenFilter;
  deviceType: "mobile" | "tablet";
  width: number;
  height: number;
};

const ScreenFilterContext = createContext<ScreenFilterContextType | null>(null);

export function ScreenFilterProvider({ children }: { children: ReactNode }) {
  const { deviceType, width, height } = useLayoutInfo();
  const normalizedDeviceType: "mobile" | "tablet" =
    deviceType === "tablet" ? "tablet" : "mobile";

  const value = useMemo(
    () => ({
      screen: normalizedDeviceType,
      deviceType: normalizedDeviceType,
      width,
      height,
    }),
    [normalizedDeviceType, width, height]
  );

  return (
    <ScreenFilterContext.Provider value={value}>
      {children}
    </ScreenFilterContext.Provider>
  );
}

export function useScreenFilter() {
  const ctx = useContext(ScreenFilterContext);
  if (!ctx) throw new Error("useScreenFilter must be used inside ScreenFilterProvider");
  return ctx;
}