import { useEffect, useRef } from 'react'
import type { PreviewWidth } from '../../hooks/useSettings'
import { frameDoc } from '../../lib/mail'

/**
 * HTML do e-mail num iframe isolado: `sandbox` sem allow-scripts, então nada do e-mail executa JS.
 * allow-same-origin só existe para medir a altura do conteúdo e ajustar o iframe.
 */
export function MailFrame({ html, width }: { html: string; width: PreviewWidth }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const f = frame.current
    if (!f) return
    let raf = 0
    // Zera a altura antes de medir: senão um corpo que preenche o quadro devolve a própria altura e cresce sem parar.
    const fit = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const doc = f.contentDocument
        if (!doc?.documentElement) return
        const scroller = f.closest('[data-scroll]')
        const top = scroller?.scrollTop ?? 0
        f.style.height = '0px'
        const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0)
        f.style.height = `${Math.min(Math.max(h, 80), 40_000)}px`
        if (scroller) scroller.scrollTop = top
      })
    }
    const timers: number[] = []
    const onLoad = () => {
      fit()
      f.contentDocument?.querySelectorAll('img').forEach((i) => i.addEventListener('load', fit))
      timers.push(window.setTimeout(fit, 300), window.setTimeout(fit, 1500))
    }
    f.addEventListener('load', onLoad)
    // o srcdoc pode ter carregado antes deste efeito rodar
    if (f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.childNodes.length) onLoad()
    const ro = new ResizeObserver(fit)
    if (box.current) ro.observe(box.current)
    return () => {
      f.removeEventListener('load', onLoad)
      ro.disconnect()
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
    }
  }, [html])

  const mobile = width === 'mobile'
  return (
    <div
      ref={box}
      style={{ maxWidth: mobile ? 390 : '100%' }}
      className={`mx-auto w-full overflow-hidden bg-white transition-all duration-300 ease-out ${
        mobile
          ? 'rounded-[2rem] border-[10px] border-zinc-800 shadow-2xl shadow-zinc-900/25 dark:border-zinc-700'
          : 'rounded-xl border-0 shadow-xs ring-1 ring-zinc-200 dark:ring-zinc-800'
      }`}
    >
      <iframe
        ref={frame}
        title="Conteúdo do e-mail"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={frameDoc(html)}
        className="block w-full border-0 bg-white"
        style={{ height: 200 }}
      />
    </div>
  )
}
