import { useEffect, useState } from "preact/hooks"
const requests = new Map<string, Promise<unknown>>()
export function requestJson<T>(filename: string): Promise<T> {
  const url = import.meta.env.BASE_URL + "data/" + filename
  if (!requests.has(url)) {
    requests.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Nie udało się pobrać danych (${response.status}).`)
          return response.json()
        })
        .catch((error) => {
          requests.delete(url)
          throw error
        }),
    )
  }
  return requests.get(url)! as Promise<T>
}
export function useJson<T>(filename: string | null) {
  const [state, setState] = useState<{ filename: string; data?: T; error?: string }>({ filename: "" })
  useEffect(() => {
    if (!filename) return
    let active = true
    requestJson<T>(filename)
      .then((data) => {
        if (active) setState({ filename, data })
      })
      .catch((error) => {
        if (active) setState({ filename, error: String(error) })
      })
    return () => {
      active = false
    }
  }, [filename])
  return state.filename === filename ? state : { data: undefined, error: undefined }
}
