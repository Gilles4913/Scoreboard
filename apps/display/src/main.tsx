import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import Scoreboard from "./components/Scoreboard"
import { connectTV } from "./tv"

const EDGE_CONTEXT_URL = import.meta.env.VITE_EDGE_CONTEXT_URL
const WS_URL = import.meta.env.VITE_TV_WS_URL

function App() {
  const [state, setState] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const params = new URLSearchParams(window.location.search)
  const token = params.get("token")

  useEffect(() => {
    if (!token) return

    async function loadSnapshot() {
      const res = await fetch(`${EDGE_CONTEXT_URL}?token=${token}`)
      const json = await res.json()

      setState(json)
      setLoading(false)
    }

    loadSnapshot()
  }, [token])

  useEffect(() => {
    if (!token || !state) return

    const tv = connectTV(WS_URL, token, (ev) => {
      setState((prev: any) => {
        const s = { ...prev }

        switch (ev.type) {
          case "score.set":
            s.home_score = ev.payload.home
            s.away_score = ev.payload.away
            break

          case "timer.set":
            s.clock = ev.payload.clock
            break

          case "timer.start":
            s.running = true
            break

          case "timer.pause":
            s.running = false
            break

          case "period.set":
            s.period = ev.payload.period
            break

          case "state.patch":
            Object.assign(s, ev.payload)
            break
        }

        return s
      })
    })

    return () => tv.close()
  }, [state, token])

  if (!token) return <div>Token manquant</div>
  if (loading) return <div>Chargement...</div>
  if (!state) return <div>Match introuvable</div>

  return <Scoreboard state={state} />
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
