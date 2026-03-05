import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import Scoreboard from "./components/Scoreboard";

const EDGE_CONTEXT_URL = import.meta.env.VITE_EDGE_CONTEXT_URL;
const WS_URL = import.meta.env.VITE_TV_WS_URL;

function App() {

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [state, setState] = useState<any>(null);

  useEffect(() => {

    async function load() {

      const res = await fetch(
        `${EDGE_CONTEXT_URL}?token=${token}`
      );

      const json = await res.json();

      setState(json);
    }

    load();

  }, [token]);

  useEffect(() => {

    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onmessage = (msg) => {

      const ev = JSON.parse(msg.data);

      setState((prev: any) => {

        const s = { ...prev };

        switch (ev.type) {

          case "score.set":
            s.home_score = ev.payload.home;
            s.away_score = ev.payload.away;
            break;

          case "timer.set":
            s.clock = ev.payload.clock;
            break;

          case "timer.start":
            s.running = true;
            break;

          case "timer.pause":
            s.running = false;
            break;

          case "period.set":
            s.period = ev.payload.period;
            break;

          case "state.patch":
            Object.assign(s, ev.payload);
            break;
        }

        return s;
      });
    };

    return () => ws.close();

  }, [token]);

  if (!state) return <div>Loading...</div>;

  return <Scoreboard state={state} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
