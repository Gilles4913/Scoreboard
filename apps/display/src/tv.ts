type TVEvent = { match_id: string; type: string; ts: number; seq: number; payload: any };

export function connectTV(wsBaseUrl: string, token: string, onEvent: (ev: TVEvent) => void) {
  let ws: WebSocket | null = null;
  let closedByClient = false;
  let retry = 0;

  const connect = () => {
    const u = new URL(wsBaseUrl);
    u.searchParams.set("token", token);
    ws = new WebSocket(u.toString());

    ws.onopen = () => { retry = 0; };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data?.type === "hello") return;
        onEvent(data as TVEvent);
      } catch {}
    };
    ws.onclose = () => {
      ws = null;
      if (closedByClient) return;
      const wait = Math.min(1000 * (2 ** retry), 15000);
      retry = Math.min(retry + 1, 5);
      setTimeout(connect, wait);
    };
  };

  connect();

  return {
    close: () => { closedByClient = true; try { ws?.close(); } catch {} },
  };
}
