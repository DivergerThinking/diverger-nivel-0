import { describe, expect, it } from "vitest";
import { saludar } from "./index.js";

describe("saludar", () => {
  it("saluda por el nombre", () => {
    expect(saludar("Ana")).toEqual({ mensaje: "Hola, Ana" });
  });
});
