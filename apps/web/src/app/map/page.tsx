import type { Metadata } from "next";
import { MapSearch } from "@/components/map/map-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Auction Map | Estate Scout",
  description:
    "Browse estate sales and auctions near you. Enter a ZIP code and radius to find listings on the map.",
};

export default function MapPage() {
  return (
    <main className="flex flex-col h-[calc(100vh-64px)]">
      <MapSearch />
    </main>
  );
}
