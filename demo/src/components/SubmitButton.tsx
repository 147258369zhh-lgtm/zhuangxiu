"use client";

import { useFormStatus } from "react-dom";

/** 表单提交按钮：自动 pending 态（转菊花文案 + 防重复提交） */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  pending = "提交中…",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: string;
  name?: string;
  value?: string;
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={isPending}
      className={`${className} disabled:pointer-events-none disabled:opacity-60`}
    >
      {isPending ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pending}
        </>
      ) : (
        children
      )}
    </button>
  );
}
