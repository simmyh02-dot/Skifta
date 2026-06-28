import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Personuppgiftsbiträdesavtal · Skifta",
};

export default function DpaPage() {
  return <LegalDoc doc="dpa" />;
}
