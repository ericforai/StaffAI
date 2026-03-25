import type express from 'express';
import type {
  DiscussionServiceContract,
  DiscussionStartupCheckResult as StartupCheckResult,
} from '../shared/discussion-service-contract';

interface StartupRouteDependencies {
  discussionService: DiscussionServiceContract;
}

export function registerStartupRoutes(app: express.Application, dependencies: StartupRouteDependencies) {
  app.get('/api/startup-check', async (_req, res) => {
    try {
      const status = await dependencies.discussionService.getStartupCheck();
      return res.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Startup check failed';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/startup-check', async (_req, res) => {
    try {
      const status = await dependencies.discussionService.getStartupCheck();
      return res.type('html').send(renderStartupCheckPage(status));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Startup check failed';
      return res.status(500).type('html').send(renderStartupCheckFailurePage(message));
    }
  });
}

function renderStartupCheckPage(status: StartupCheckResult): string {
  const cards = status.checks
    .map((check) => {
      const tone =
        check.status === 'ready'
          ? 'border-color:#1d8f63;background:rgba(16,185,129,0.08);'
          : check.status === 'disabled'
            ? 'border-color:#6b7280;background:rgba(148,163,184,0.08);'
            : 'border-color:#9f1239;background:rgba(244,63,94,0.08);';

      return `
          <article style="border:1px solid;border-radius:20px;padding:20px;${tone}">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
              <h2 style="margin:0;font-size:20px;text-transform:uppercase;letter-spacing:.08em;">${check.name}</h2>
              <span style="font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);text-transform:uppercase;letter-spacing:.12em;">${check.status}</span>
            </div>
            <p style="margin:14px 0 0;color:#cbd5e1;line-height:1.6;">${check.detail}</p>
          </article>
        `;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>HQ Startup Check</title>
  </head>
  <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(circle at top left,rgba(22,163,74,.08),transparent 30%),radial-gradient(circle at top right,rgba(56,189,248,.10),transparent 30%),#07111c;color:#f8fafc;">
    <main style="max-width:1080px;margin:0 auto;padding:48px 24px 72px;">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#67e8f9;">The Agency HQ</p>
      <h1 style="margin:0;font-size:48px;line-height:1;font-weight:900;">Startup Check</h1>
      <p style="max-width:760px;margin:18px 0 0;color:#94a3b8;font-size:17px;line-height:1.7;">
        这个页面用于确认 HQ 后端是否已经准备好运行本地多代理讨论。页面会同时展示你的偏好执行器、当前真正会先尝试的执行器，以及完整回退顺序。
      </p>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:28px;">
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Preferred</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.preferredExecutor}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Effective Default</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.effectiveDefaultExecutor}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Timeout</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${Math.round(status.discussionTimeoutMs / 1000)}s</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:${status.overallReady ? 'rgba(16,185,129,.10)' : 'rgba(244,63,94,.10)'};">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Overall</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.overallReady ? 'READY' : 'BLOCKED'}</div>
        </div>
      </section>

      <section style="margin-top:24px;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:24px;background:rgba(15,23,42,.55);">
        <h2 style="margin:0 0 12px;font-size:20px;">Executor Attempt Order</h2>
        <p style="margin:0;color:#cbd5e1;line-height:1.8;">
          ${status.executorAttemptOrder && status.executorAttemptOrder.length > 0 ? status.executorAttemptOrder.join(' → ') : status.effectiveDefaultExecutor}
        </p>
      </section>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px;">
        ${cards}
      </section>

      <section style="margin-top:24px;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:24px;background:rgba(15,23,42,.55);">
        <h2 style="margin:0 0 12px;font-size:20px;">Recommended startup state</h2>
        <ol style="margin:0;padding-left:18px;color:#cbd5e1;line-height:1.8;">
          <li>优先让你最信任的本地执行器保持可用，再把云端执行器留作最后回退。</li>
          <li>确保本地 CLI 已登录且可执行，否则系统会自动尝试下一条路径。</li>
          <li>当回退顺序和你的预期不一致时，优先检查环境变量与本机 CLI 可用性。</li>
        </ol>
      </section>
    </main>
  </body>
</html>`;
}

function renderStartupCheckFailurePage(message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>HQ Startup Check</title></head>
  <body style="margin:0;background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:760px;margin:0 auto;padding:56px 24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#fda4af;">The Agency HQ</p>
      <h1 style="margin:0;font-size:42px;font-weight:900;">Startup Check Failed</h1>
      <p style="margin-top:18px;color:#cbd5e1;line-height:1.7;">${message}</p>
    </main>
  </body>
</html>`;
}
