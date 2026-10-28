import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="text-lg font-semibold">页面不存在</h1>
      <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
        链接可能已过期，或邀请码输入有误。
        <br />
        请联系你的工长重新获取工地邀请。
      </p>
      <Link href="/" className="btn btn-primary mt-2">返回工地总览</Link>
      <div className="mt-4 text-[10px] text-zinc-300">装修管理平台 Demo</div>
    </div>
  );
}
