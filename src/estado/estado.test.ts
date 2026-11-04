import { describe, expect, it } from "vitest";
import { ERROR_FORMATO, estadoDelServicio, formatoAdmitido } from "./estado.js";

describe("estadoDelServicio", () => {
  it("dice que el servicio está en marcha", () => {
    expect(estadoDelServicio()).toEqual({ estado: "en marcha" });
  });
});

describe("formatoAdmitido", () => {
  it("admite la petición sin formato", () => {
    expect(formatoAdmitido(undefined)).toBe(true);
  });

  it("admite el formato json", () => {
    expect(formatoAdmitido("json")).toBe(true);
  });

  it("no admite el formato xml", () => {
    expect(formatoAdmitido("xml")).toBe(false);
  });
});

describe("ERROR_FORMATO", () => {
  it("dice que el formato no está admitido, con el texto del contrato", () => {
    expect(ERROR_FORMATO).toEqual({ error: "Formato no admitido" });
  });
});
