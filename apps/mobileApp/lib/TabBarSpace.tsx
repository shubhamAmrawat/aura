import { createContext, useContext } from "react";

/**
 * Height a scrolling list needs at its bottom so its last items can scroll clear of the
 * floating tab bar. 0 outside the tab screens (detail, category, settings…).
 */
export const TabBarSpaceContext = createContext(0);

export const useTabBarSpace = () => useContext(TabBarSpaceContext);
