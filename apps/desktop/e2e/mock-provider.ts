import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Servidor local que imita uma API compatível com OpenAI. Usado só em testes:
 * nenhuma chave real e nenhum dado sai da máquina.
 */
export interface MockProvider {
  url: string;
  requests: Array<{ method: string; path: string }>;
  close(): Promise<void>;
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export async function startMockProvider(): Promise<MockProvider> {
  const requests: MockProvider["requests"] = [];
  const server: Server = createServer(async (req, res) => {
    const path = req.url ?? "";
    requests.push({ method: req.method ?? "", path });
    const raw = await body(req);
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && path === "/v1/models")
      return res.end(JSON.stringify({ data: [{ id: "mock-transcribe" }, { id: "mock-chat" }] }));
    if (req.method === "POST" && path === "/v1/audio/transcriptions") {
      if (!raw.includes("RIFF")) {
        res.statusCode = 400;
        return res.end("{}");
      }
      return res.end(JSON.stringify({ text: "Maria vai enviar o parecer até sexta-feira. Fica decidido que a audiência será remarcada." }));
    }
    if (req.method === "POST" && path === "/v1/chat/completions") {
      const ids = [...raw.matchAll(/\[(seg-\d+-\d+) \|/g)].map((m) => m[1]);
      const first = ids[0] ?? "seg-0-0";
      const analysis = {
        summary: "Reunião curta sobre o parecer e a remarcação da audiência.",
        topics: [{ title: "Parecer técnico", description: "Envio do parecer", basis: "explicit", evidence: [{ segmentIds: [first] }] }],
        decisions: [
          {
            title: "Remarcar a audiência",
            description: "",
            basis: "explicit",
            evidence: [{ segmentIds: [first], quote: "a audiência será remarcada" }]
          }
        ],
        actionItems: [
          {
            title: "Enviar parecer",
            description: "",
            basis: "explicit",
            assignee: "Maria",
            dueDate: "sexta-feira",
            evidence: [{ segmentIds: [first] }]
          },
          { title: "Ligar para cartório", description: "", basis: "explicit", assignee: "Pedro", evidence: [{ segmentIds: [first] }] }
        ],
        questionsAndAnswers: [],
        pendingItems: [],
        attentionPoints: [],
        nextSteps: []
      };
      return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}/v1`, requests, close: () => new Promise((r) => server.close(() => r())) };
}
