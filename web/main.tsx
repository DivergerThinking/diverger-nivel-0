import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { botonDeGoogle } from "./sesion.js";

const raiz = document.getElementById("raiz");
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App botonDeGoogle={botonDeGoogle} />
    </StrictMode>,
  );
}
