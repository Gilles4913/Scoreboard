type TVEvent = {
  match_id: string
  type: string
  ts: number
  seq: number
  payload: any
}

export function connectTV(
  wsBaseUrl: string,
  token: string,
  onEvent: (ev: TVEvent) => void
) {
  let ws: WebSocket | null = null
  let closed = false
  let retry = 0

  const connect = () => {
    const url = new URL(wsBaseUrl)
    url.searchParams.set("token", token)

    ws = new WebSocket(url.toString())

    ws.onopen = () => {
      retry = 0
      console.log("TV connected")
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        if (data.type === "hello") return
        onEvent(data)
      } catch {}
    }

    ws.onclose = () => {
      if (closed) return
      retry++
      const wait = Math.min(2000 * retry, 15000)
      console.log("TV reconnect in", wait)
      setTimeout(connect, wait)
    }
  }

  connect()

  return {
    close() {
      closed = true
      ws?.close()
    }
  }
}
