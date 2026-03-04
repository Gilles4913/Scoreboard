type TVEvent = {
  match_id: string;
  type: string;
  ts: number;
  seq: number;
  payload: any;
};

export type TVHandlers = {
  onEvent: (ev: TVEvent) => void;
  onStatus?: (s: "connecting" | "open" | "closed") => void;
};

export function connectTV(url: string, token: string, handlers: TVHandlers) {
  let ws: WebSocket | null = null;
  let closedByClient = false;
  let retry = 0;

  const connect = () => {
    handlers.onStatus?.("connecting");
    const u = new URL(url);
    u.searchParams.set("token", token);

    ws = new WebSocket(u.toString());

    ws.onopen = () => {
      retry = 0;
      handlers.onStatus?.("open");
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data?.type === "hello") return;
        handlers.onEvent(data as TVEvent);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      handlers.onStatus?.("closed");
      ws = null;
      if (closedByClient) return;

      // backoff simple
      const wait = Math.min(1000 * (2 ** retry), 15000);
      retry = Math.min(retry + 1, 5);
      setTimeout(connect, wait);
    };
  };

  connect();

  return {
    close: () => {
      closedByClient = true;
      try { ws?.close(); } catch {}
    },
    send: (payload: any) => {
      try { ws?.send(JSON.stringify(payload)); } catch {}
    },
  };
}
