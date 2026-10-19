"use client";

import { useEffect } from "react";
import { rememberViewed } from "@/lib/recently-viewed";

/** On a book's page: puts it first in the home page's "Recently Viewed" row. Renders nothing. */
export function RememberViewed({ id }: { id: number }) {
  useEffect(() => {
    rememberViewed(id);
  }, [id]);

  return null;
}
