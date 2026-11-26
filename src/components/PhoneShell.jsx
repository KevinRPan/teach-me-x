import { cn } from '../lib/utils';
import { useVisualViewport } from '../lib/viewport';

export default function PhoneShell({
  children,
  sampleMode = false,
  banner = '',
  onDismissBanner,
  locked = false,
}) {
  useVisualViewport();

  return (
    <div className="bg-neutral-950 text-white">
      <div
        className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden bg-neutral-950 md:rounded-[2rem] md:border md:border-neutral-800"
        style={{ top: 'var(--vv-top, 0px)', height: 'var(--vvh, 100dvh)' }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(64,64,64,0.55),transparent_70%)]" />
        <div className={cn('relative flex min-h-0 flex-1 flex-col', locked && 'overflow-hidden')}>
          <div className="shrink-0 pt-[env(safe-area-inset-top)]">
            {sampleMode && (
              <p className="bg-amber-400/10 px-4 py-2 text-xs leading-5 text-amber-100">
                Practice mode. Example plans until a Gemini key is set on the server.
              </p>
            )}
            {banner && (
              <div className="flex items-start gap-3 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                <p className="min-w-0 flex-1">{banner}</p>
                {onDismissBanner && (
                  <button type="button" onClick={onDismissBanner} className="shrink-0 text-xs font-semibold uppercase tracking-wide">
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
