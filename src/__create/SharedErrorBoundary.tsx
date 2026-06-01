import React from "react";

/**
 * Minimaler SharedErrorBoundary.
 * Ziel: Import in app/+not-found.tsx darf niemals Metro killen.
 * Optional später auf echtes ErrorBoundary (react-error-boundary) upgraden.
 */
export default function SharedErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}