"use client";

import { useState } from "react";

/** 可点击放大的图片（全屏灯箱，点击任意处关闭） */
export function ZoomImg({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className={`${className} cursor-zoom-in transition hover:brightness-105`}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-2xl shadow-2xl" />
          <div className="absolute bottom-5 text-xs text-white/60">点击任意处关闭</div>
        </div>
      )}
    </>
  );
}
