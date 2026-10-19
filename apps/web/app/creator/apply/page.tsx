import type { Metadata } from "next";
import ApplyForm from "./ApplyForm";

export const metadata: Metadata = {
  title: "Become a creator",
  robots: { index: false, follow: false },
};

export default function CreatorApplyPage() {
  return <ApplyForm />;
}
