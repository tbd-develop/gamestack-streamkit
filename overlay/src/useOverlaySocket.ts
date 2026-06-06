import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { OverlayEvent, ShowEvent } from './types'

/**
 * Connects to the StreamKit WebSocket and exposes the currently-active "show" event.
 * Auto-reconnects (OBS reloads browser sources frequently). The WS URL defaults to
 * ws://<host>:8420/ws and can be overridden with a `?ws=` query param.
 */
export function useOverlaySocket() {
  const activeShow = shallowRef<ShowEvent | null>(null)
  const connected = ref(false)

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function wsUrl(): string {
    const override = new URLSearchParams(location.search).get('ws')
    return override ?? `ws://${location.hostname}:8420/ws`
  }

  function connect() {
    ws = new WebSocket(wsUrl())

    ws.onopen = () => {
      connected.value = true
    }

    ws.onmessage = (e) => {
      let ev: OverlayEvent
      try {
        ev = JSON.parse(e.data) as OverlayEvent
      } catch {
        return
      }
      if (ev.type === 'show') activeShow.value = ev
      else if (ev.type === 'hide') activeShow.value = null
      // 'state' is reserved for Phase 2 (persistent now-playing).
    }

    ws.onclose = () => {
      connected.value = false
      reconnectTimer = setTimeout(connect, 1500)
    }

    ws.onerror = () => ws?.close()
  }

  onMounted(connect)
  onUnmounted(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  })

  return { activeShow, connected }
}
