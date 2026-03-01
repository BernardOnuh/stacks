"use client";

import dynamic from "next/dynamic";

const StackSwapClient = dynamic(
  () => import("./StackSwapClient").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-orange-500 rounded-full border-t-transparent"></div>
      </div>
    ),
  }
);

export default function Page() {
  return <StackSwapClient />;
}
