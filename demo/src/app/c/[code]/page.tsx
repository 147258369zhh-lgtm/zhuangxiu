import { notFound } from "next/navigation";
import { getAccepts, getLogs, getSite, getSiteByCode, getSteps } from "@/lib/data";
import { confirmAcceptAction } from "@/app/actions";
import { Progress, fmtTime } from "@/components/ui";

export default async function ClientPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const site = getSiteByCode(code);
  if (!site) notFound();
  const steps = getSteps(site.id);
  const logs = getLogs(site.id);
  const accepts = getAccepts(site.id);

  const stepDone = steps.filter((s) => s.status === "已完成").length;
  const pct = steps.length ? (stepDone / steps.length) * 100 : 0;
  const current = steps.find((s) => s.status === "进行中");
  const accDone = accepts.filter((a) => a.done).length;

  const groups = [...new Set(accepts.map((a) => a.step_name))].map((name) => ({
    name,
    items: accepts.filter((a) => a.step_name === name),
  }));

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-6">
      <div className="mb-5">
        <div className="text-xs font-medium text-amber-600">{site.community}</div>
        <h1 className="mt-0.5 text-xl font-bold">{site.name}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">{site.layout}</span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">工长 {site.foreman}</span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">演示装饰</span>
        </div>
      </div>

      <div className="card mb-5 p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-zinc-500">装修总进度</div>
            <div className="mt-0.5 text-3xl font-bold tabular-nums">{Math.round(pct)}<span className="text-base text-zinc-400">%</span></div>
          </div>
          <div className="text-right text-[11px] text-zinc-400">
            <div>当前工序</div>
            <div className="mt-0.5 text-sm font-semibold text-amber-600">{current ? current.name : pct >= 100 ? "已竣工 🎉" : "即将开工"}</div>
          </div>
        </div>
        <div className="mt-3">
          <Progress value={pct} tone="amber" />
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-zinc-400">
          {steps.map((s) => (
            <span key={s.id} className={s.status === "已完成" ? "font-semibold text-emerald-600" : s.status === "进行中" ? "font-semibold text-amber-600" : ""}>
              {s.name.replace("改造", "").replace("铺贴", "").replace("制作", "").replace("涂装", "").replace("收尾", "").replace("验收", "竣")}
            </span>
          ))}
        </div>
      </div>

      <div className="card mb-5 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-semibold">📋 验收打卡</div>
          <div className="text-[11px] text-zinc-400">已确认 {accDone}/{accepts.length}</div>
        </div>
        <p className="mb-3 text-[11px] text-zinc-400">逐项对照检查，确认合格后拍照签字，双方实时同步。</p>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="mb-1.5 text-[11px] font-semibold text-zinc-400">· {g.name}</div>
              <div className="space-y-2">
                {g.items.map((it) =>
                  it.done ? (
                    <div key={it.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-emerald-500">✓</span>
                        <span className="text-zinc-700">{it.item}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                        <span className="font-medium text-emerald-600">{it.checked_by} 已签字</span>
                        <span>{fmtTime(it.checked_at)}</span>
                      </div>
                      {it.comment && <div className="mt-1 text-xs text-zinc-500">“{it.comment}”</div>}
                      {it.photo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`/uploads/${it.photo}`} alt="验收照片" className="mt-2 h-36 w-full rounded-lg object-cover" />
                      )}
                    </div>
                  ) : (
                    <form key={it.id} action={confirmAcceptAction} className="rounded-xl border border-zinc-200 px-3.5 py-2.5">
                      <input type="hidden" name="acceptId" value={it.id} />
                      <input type="hidden" name="code" value={site.code} />
                      <div className="text-sm text-zinc-700">{it.item}</div>
                      <div className="mt-2 flex gap-2">
                        <input name="comment" className="input flex-1 px-2.5 py-1.5 text-xs" placeholder="备注（选填）" />
                        <input name="photo" type="file" accept="image/*" className="w-28 text-[10px] file:mr-1 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2 file:py-0.5 file:text-[10px]" />
                      </div>
                      <button className="btn btn-amber mt-2 w-full py-1.5 text-xs">确认合格，签字留档</button>
                    </form>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold">💬 工地动态</div>
        <div className="space-y-3">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl bg-zinc-50 px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="rounded-md bg-white px-1.5 py-0.5 font-medium text-zinc-600 ring-1 ring-zinc-200">{l.author}</span>
                {l.step_name && <span>{l.step_name}</span>}
                <span className="ml-auto">{fmtTime(l.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed">{l.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-center text-[10px] text-zinc-300">装修管理平台 Demo · 业主端 {site.code}</div>
    </div>
  );
}
