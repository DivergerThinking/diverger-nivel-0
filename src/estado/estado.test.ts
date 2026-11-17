import { describe, expect, it } from "vitest";
import { consultarEstado } from "./index.js";

describe("consultarEstado", () => {
  it("responde 200 con el servicio en marcha", () => {
    expect(consultarEstado()).toEqual({ codigo: 200, cuerpo: { estado: "en marcha" } });
  });

  it("responde 400 con «Formato no admitido» si se pide un formato", () => {
    expect(consultarEstado("xml")).toEqual({
      codigo: 400,
      cuerpo: { error: "Formato no admitido" },
    });
  });
});
