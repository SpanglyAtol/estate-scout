import { redirect } from "next/navigation";

/**
 * The map view has been merged into the Estate Sales finder.
 * Redirect anyone hitting /map directly.
 */
export default function MapPage() {
  redirect("/estate-sales");
}
