"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BoardingIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/boarding/list");
  }, [router]);
  return null;
}

