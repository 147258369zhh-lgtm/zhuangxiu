"use client";

/** 调起浏览器打印（另存 PDF） */
export function PrintButton({
  className = "btn btn-primary text-xs",
  label = "🖨 打印 / 另存 PDF",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
