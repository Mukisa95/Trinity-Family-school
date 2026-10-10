import { STARTUP_SCREEN_ID, NON_LOGIN_PUBLIC_ROUTES } from '@/lib/performance/startup-display';

// Critical styles let the server-rendered loader paint before app bundles.
const startupStyles = `
.startup-screen{position:fixed;inset:0;z-index:100;display:flex;min-height:100dvh;align-items:center;justify-content:center;background:#111827;color:#fff;text-align:center;padding:24px;font-family:system-ui,sans-serif;transition:opacity 300ms ease-out}
.startup-screen[hidden]{display:none}.startup-screen[data-startup-state="fading"]{opacity:0;pointer-events:none}
.startup-screen section{width:100%;max-width:320px}.startup-brand{display:flex;align-items:center;justify-content:center;gap:16px}
.startup-logo{width:80px;height:80px;display:flex;align-items:center;justify-content:center;border:1px solid #ffffff26;border-radius:16px;background:#ffffff1a}
.startup-logo img{width:64px;height:64px;object-fit:contain}.startup-blocks{position:relative;width:48px;height:48px}
.startup-block{position:absolute;width:16px;height:16px;border-radius:4px;animation:startup-block-motion 900ms ease-in-out infinite;will-change:transform,opacity}
.startup-block-one{left:0;top:0;background:#7dd3fc}.startup-block-two{left:24px;top:0;background:#c4b5fd;animation-delay:-300ms}.startup-block-three{left:12px;top:24px;background:#6ee7b7;animation-delay:-600ms}
.startup-screen h1{margin:20px 0 8px;font-size:18px;font-weight:600}.startup-message{margin:0;font-size:14px;color:#cbd5e1}.startup-motto{margin:12px 0 0;font-size:12px;color:#94a3b8}
@keyframes startup-block-motion{0%,100%{transform:translate(0,0) scale(.85);opacity:.5}50%{transform:translate(4px,4px) scale(1.05);opacity:1}}
@media(prefers-reduced-motion:reduce){.startup-block{animation:none;will-change:auto}.startup-screen{transition:none}}
html[data-effects="reduced"] .startup-block{animation:none;will-change:auto}
`;

/** Static surface: no hydration-dependent animation, timers or image optimizer. */
export function BrandedAuthScreen({ message, isExiting = false, id }: { message: string; isExiting?: boolean; id?: string }) {
  return <>
    <style>{startupStyles}</style>
    <main id={id} aria-busy="true" role="status" className="startup-screen" data-startup-state={isExiting ? 'fading' : 'visible'}>
      <section>
        <div className="startup-brand" aria-hidden="true">
          <div className="startup-logo"><img src="/trinity-logo-192.png" alt="" width={64} height={64} /></div>
          <div className="startup-blocks"><span className="startup-block startup-block-one" /><span className="startup-block startup-block-two" /><span className="startup-block startup-block-three" /></div>
        </div>
        <h1>Trinity Family School</h1>
        <p className="startup-message">{message}</p>
        <p className="startup-motto">Strive to Excel</p>
      </section>
    </main>
  </>;
}

/** Outside the app providers: HTML is visible before their hydration. */
export function StartupBootstrap() {
  const publicRouteScript = `if(${JSON.stringify(NON_LOGIN_PUBLIC_ROUTES)}.some(p=>location.pathname===p||location.pathname.startsWith(p+'/')))document.getElementById('${STARTUP_SCREEN_ID}').hidden=true;`;
  return <>
    <BrandedAuthScreen id={STARTUP_SCREEN_ID} message="Opening your school workspace…" />
    <script dangerouslySetInnerHTML={{ __html: publicRouteScript }} />
    <noscript><style>{`#${STARTUP_SCREEN_ID}{display:none}`}</style></noscript>
  </>;
}
