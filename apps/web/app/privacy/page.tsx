import { permanentRedirect } from "next/navigation";

/** Old address of the privacy policy: everything now lives at /privacy-policy. */
export default function PrivacyRedirect() {
  permanentRedirect("/privacy-policy");
}
