import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

/** Lock-screen style clock drawn over the wallpaper preview, so users can judge how it looks before applying. */
const LockClockPreview = ({ width }: { width: number }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    // line up with the next minute, then update every minute
    const first = setTimeout(() => {
      tick();
      timer = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    let timer: ReturnType<typeof setInterval> | undefined;
    return () => {
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, []);

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?(AM|PM|am|pm)$/, "");
  const date = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={[styles.date, { fontSize: Math.max(11, width * 0.045) }]}>{date}</Text>
      <Text style={[styles.time, { fontSize: width * 0.24, lineHeight: width * 0.27 }]}>{time}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingTop: "16%",
    zIndex: 2,
  },
  date: {
    color: "#FFFFFF",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 8,
  },
  time: {
    color: "#FFFFFF",
    fontWeight: "300",
    letterSpacing: -1,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 12,
  },
});

export default LockClockPreview;
