import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getAccepts, getLogs, getSite, getSteps } from "@/lib/data";
import { addLogAction, advanceStepAction } from "@/app/actions";
import { Progress, StatusBadge, fmtTime } from "@/components/ui";

export default async function GongdiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();
  const steps = getSteps(site.id);
  const logs = getLogs(site.id);
  const accepts = getAccepts(site.id);

  const host = (await headers()).get("host") ?? "localhost:3300";
  const inviteUrl = `http://${host}/c/${site.code}`;
  const qr = await QRCode.toDataURL(inviteUrl, {
    width: 320, margin: 1, color: { dark: "#3730a3", light: "#ffffff" },
  });

  const accDone = accepts.filter((a) => a.done).length;
  const byStep = [...new Set(accepts.map((a) => a.step_name))].map((name) => {
    const items = accepts.filter((a) => a.step_name === name);
    return { name, done: items.filter((i) => i.done).length, total: items.length };
  });

  return (
    <div>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">← 返回总览</Link>
          <div className="text-sm text-zinc-500">B端 · 工地详情</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold">{site.name}</h1>
            <div className="mt-1 text-xs text-zinc-500">{site.community} · {site.layout}</div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>业主 <b className="text-zinc-800">{site.owner_name}</b></span>
            <span>工长 <b className="text-zinc-800">{site.foreman}</b></span>
            <span>合同额 <b className="text-zinc-800">¥{(site.budget || 0).toLocaleString("zh-CN")}</b></span>
            <span>邀请码 <b className="font-mono text-indigo-600">{site.code}</b></span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="card p-5">
              <div className="mb-4 text-sm font-semibold">🧱 工序进度</div>
              <div className="space-y-2.5">
                {steps.map((st) => (
                  <div key={st.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-zinc-400 ring-1 ring-zinc-200">
                      {st.sort + 1}
                    </span>
                    <span className="text-sm font-medium">{st.name}</span>
                    <StatusBadge status={st.status} />
                    <form action={advanceStepAction} className="ml-auto">
                      <input type="hidden" name="stepId" value={st.id} />
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="current" value={st.status} />
                      <button className="btn btn-ghost px-3 py-1 text-xs">
                        {st.status === "待开工" ? "开始施工 →" : st.status === "进行中" ? "标记完成 →" : "重置"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-4 text-sm font-semibold">📝 工地日志 <span className="ml-1 text-xs font-normal text-zinc-400">业主端实时可见</span></div>
              <div className="space-y-3">
                {logs.map((l) => (
                  <div key={l.id} className="rounded-xl border border-zinc-100 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{l.author}</span>
                      {l.step_name && <span>{l.step_name}</span>}
                      <span className="ml-auto">{fmtTime(l.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed">{l.content}</p>
                  </div>
                ))}
              </div>
              <form action={addLogAction} className="mt-4 border-t border-zinc-100 pt-4">
                <input type="hidden" name="siteId" value={site.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">署名</label>
                    <select name="author" className="input">
                      {["李工长", "赵工长", "张监理", "项目经理"].map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">所属工序</label>
                    <select name="stepName" className="input">
                      {steps.map((s) => <option key={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">日志内容</label>
                  <textarea name="content" rows={2} className="input" placeholder="今天完成了什么、明天做什么、需要业主配合什么……" />
                </div>
                <button className="btn btn-primary mt-3">发布日志</button>
              </form>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5 text-center">
              <div className="mb-3 text-sm font-semibold">📲 邀请业主进工地</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="业主端邀请二维码" className="mx-auto h-44 w-44 rounded-xl ring-1 ring-zinc-100" />
              <div className="mt-3 break-all font-mono text-[11px] text-zinc-400">{inviteUrl}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                业主微信扫码打开：看实时进度、按清单做验收打卡、拍照留档。
              </p>
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">✅ 验收进度</span>
                <span className="text-xs text-zinc-400">{accDone}/{accepts.length}</span>
              </div>
              <Progress value={accepts.length ? (accDone / accepts.length) * 100 : 0} tone="amber" />
              <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
                {byStep.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5">
                    <span>{s.name}</span>
                    <span className="font-mono text-zinc-400">{s.done}/{s.total}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
