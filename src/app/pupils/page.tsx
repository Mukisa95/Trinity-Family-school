"use client";

import PupilsManagement from './pupils-management';

export default function PupilsPage() {
  // One page owns the class selector, cached rows and management actions.
  // Optional tools load on demand; the list is never replaced by another UI.
  return <PupilsManagement />;
}
