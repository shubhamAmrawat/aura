import { Instrument_Serif } from "next/font/google";

// Display serif for the sign-in / sign-up headlines (loaded only on /login).
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={serif.variable}>{children}</div>;
}
