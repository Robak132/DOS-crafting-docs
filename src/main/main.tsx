import { render } from "preact"
import { App } from "./App"
import "./styles.css"
import "./table.css"
const root = document.getElementById("app")!
root.replaceChildren()
render(<App />, root)
