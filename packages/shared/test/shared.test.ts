import { describe, expect, it, vi } from "vitest";
import {
  OuveError,
  createLogger,
  errorFromHttpStatus,
  formatTimestamp,
  redactFields,
  redactString,
  retry,
  sanitizeLabel,
  sanitizeText,
  sleep,
  validateEndpointUrl,
  withTimeout
} from "../src/index.js";

describe("redação de logs", () => {
  it("mascara padrões de chave conhecidos", () => {
    const out = redactString("falha com sk-ant-abc123456789 e AIzaSyD1234567890123456789012 Bearer abc.def");
    expect(out).not.toMatch(/sk-ant-abc/);
    expect(out).not.toMatch(/AIza/);
    expect(out).not.toMatch(/abc\.def/);
  });

  it("remove campos sensíveis e objetos", () => {
    const out = redactFields({ apiKey: "x", transcript: "conteúdo", status: 500, nested: { a: 1 }, url: "https://x?key=segredo" });
    expect(out).toEqual({
      apiKey: "[REDIGIDO]",
      transcript: "[REDIGIDO]",
      status: 500,
      nested: "[omitido]",
      url: "https://x?key=[REDIGIDO]"
    });
  });

  it("logger aplica redação antes do destino", () => {
    const sink = vi.fn();
    createLogger("teste", sink).info("chave sk-1234567890abc", { text: "segredo" });
    expect(sink).toHaveBeenCalledWith("info", "[teste] chave [REDIGIDO]", { text: "[REDIGIDO]" });
  });
});

describe("texto", () => {
  it("sanitiza controles e limita tamanho", () => {
    expect(sanitizeText("a\u0000b\nc", 10)).toBe("ab\nc");
    expect(sanitizeText("abcdef", 3)).toBe("abc");
    expect(sanitizeLabel("  Falante\t 1  ")).toBe("Falante 1");
  });

  it("formata timestamps", () => {
    expect(formatTimestamp(3_723_000)).toBe("01:02:03");
    expect(formatTimestamp(-5)).toBe("00:00:00");
  });

  it("valida endpoints", () => {
    expect(validateEndpointUrl("https://api.exemplo.com/v1").hostname).toBe("api.exemplo.com");
    expect(validateEndpointUrl("http://localhost:11434/v1").port).toBe("11434");
    expect(() => validateEndpointUrl("http://api.exemplo.com")).toThrow(/HTTPS/);
    expect(() => validateEndpointUrl("https://u:p@x.com")).toThrow(/credenciais/);
    expect(() => validateEndpointUrl("nada")).toThrow(/inválido/);
  });
});

describe("erros HTTP", () => {
  it("classifica status", () => {
    expect(errorFromHttpStatus(401, "P").code).toBe("auth");
    expect(errorFromHttpStatus(429, "P").retryable).toBe(true);
    expect(errorFromHttpStatus(503, "P").code).toBe("provider-unavailable");
    expect(errorFromHttpStatus(400, "P").retryable).toBe(false);
  });
});

describe("assíncrono", () => {
  it("repete erros reexecutáveis e para nos definitivos", async () => {
    const delay = vi.fn(async () => undefined);
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new OuveError("network", "falha");
        return "ok";
      },
      { retries: 3, baseDelayMs: 10, delay }
    );
    expect(result).toBe("ok");
    expect(delay).toHaveBeenNthCalledWith(1, 10, undefined);
    expect(delay).toHaveBeenNthCalledWith(2, 20, undefined);

    await expect(
      retry(async () => Promise.reject(new OuveError("auth", "x")), { retries: 3, baseDelayMs: 1, delay })
    ).rejects.toMatchObject({ code: "auth" });
  });

  it("cancela sleep e diferencia timeout", async () => {
    const controller = new AbortController();
    const pending = sleep(1000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });

    const t = withTimeout(5);
    await new Promise((r) => setTimeout(r, 15));
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut()).toBe(true);
    t.dispose();
  });
});
