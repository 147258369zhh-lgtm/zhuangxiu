"use client";

/** 调起浏览器打印（另存 PDF） */
export function PrintButton({ className = "btn btn-primary text-xs" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      🖨 打印 / 另存 PDF
    </button>
  );
}
