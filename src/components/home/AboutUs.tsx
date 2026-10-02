"use client";

import { useEffect, useState } from "react";

export function AboutUs() {
  const [isKuzeyFirst, setIsKuzeyFirst] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsKuzeyFirst(Math.random() > 0.5);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleMouseEnter = () => {
    setIsKuzeyFirst((current) => !current);
  };

  return (
    <div className="flex flex-col items-center justify-center px-6 py-6 text-center">
      <div
        className="group relative inline-flex flex-col items-center"
        onMouseEnter={handleMouseEnter}
      >
        <p
          className="cursor-help text-sm font-medium text-surface-500 decoration-surface-300 decoration-dotted underline-offset-4 transition-colors hover:text-surface-700 group-hover:underline"
          tabIndex={0}
        >
          AFL 2022 mezunu mühendislik öğrencileri tarafından hazırlandı.
        </p>

        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[min(22rem,calc(100vw-3rem))] -translate-x-1/2 translate-y-1 rounded-2xl border border-surface-200 bg-white p-4 text-left text-sm text-surface-500 opacity-0 shadow-[0_18px_46px_-28px_rgba(17,17,17,0.35)] transition duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-surface-200 bg-white" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="block font-semibold text-surface-700 mb-1">Yazılım Geliştirme</span>
              {isKuzeyFirst ? (
                <>
                  <span className="block leading-6">Kuzey Sınay</span>
                  <span className="block leading-6">İbrahim Ayanoğlu</span>
                </>
              ) : (
                <>
                  <span className="block leading-6">İbrahim Ayanoğlu</span>
                  <span className="block leading-6">Kuzey Sınay</span>
                </>
              )}
            </div>
            <div>
              <span className="block font-semibold text-surface-700 mb-1">Güvenlik ve Test</span>
              <span className="block leading-6">Ahmet Faruk Bilgin</span>
              <span className="block leading-6">Bilal Yıldırım</span>
              <span className="block leading-6">Yusuf Sami Akca</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
