import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeWav } from "@ouve/capture";
import { LiveAudioRecorder, diarizationArgs, parseProgress, wavPcm } from "../src/main/diarization";
import { LocalAiService } from "../src/main/local-ai-service";

const tone = (seconds: number) =>
  encodeWav(
    new Float32Array(16_000 * seconds).map((_, i) => Math.sin(i / 10) * 0.2),
    16_000
  );

describe("separação de vozes (sherpa-onnx)", () => {
  it("monta os argumentos com número de pessoas ou limiar automático", () => {
    const base = { segmentationModel: "seg.onnx", embeddingModel: "voz.onnx", threads: 2.7 };
    expect(diarizationArgs("a.wav", { ...base, speakers: 3 })).toContain("--clustering.num-clusters=3");
    const auto = diarizationArgs("a.wav", { ...base, speakers: 0 });
    expect(auto).toContain("--clustering.cluster-threshold=0.9");
    expect(auto).toContain("--embedding.num-threads=2");
    expect(auto.at(-1)).toBe("a.wav");
  });

  it("lê o progresso do stderr", () => {
    expect(parseProgress("progress 10.00%\nprogress 42.50%\n")).toBe(42);
    expect(parseProgress("nada")).toBeUndefined();
  });

  it("grava os blocos ao vivo em ordem num WAV válido", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ouve-rec-"));
    const rec = new LiveAudioRecorder(join(dir, "ao-vivo.wav"));
    const a = tone(1);
    const b = tone(2);
    await rec.append(1, b); // chega fora de ordem
    await rec.append(0, a);
    await rec.append(0, a); // repetido: ignorado
    expect(await rec.finish()).toBe(3000);
    const wav = new Uint8Array(await readFile(rec.path));
    expect(wavPcm(wav).length).toBe(3 * 32_000);
  });

  it("recusa áudio fora do formato 16 kHz mono", () => {
    expect(() => wavPcm(encodeWav(new Float32Array(100), 44_100))).toThrow(/16 kHz/);
  });

  it("explica quando a separação não está instalada", async () => {
    const svc = new LocalAiService({
      userDataDir: await mkdtemp(join(tmpdir(), "ouve-d-")),
      tempDir: tmpdir(),
      platform: "win32",
      threads: 1,
      fetch,
      openInstaller: async () => undefined
    });
    expect((await svc.state()).diarizationBundled).toBe(false);
    await expect(svc.diarize("x.wav", { model: "campplus", speakers: 0, threads: 1 }, () => undefined)).rejects.toThrow(
      /não está incluída/
    );
  });

  // Teste com o binário e modelos reais (opcional): OUVE_TEST_SHERPA_DIR com o executável,
  // segmentation.onnx, o modelo campplus e 0-four-speakers-zh.wav.
  const real = process.env.OUVE_TEST_SHERPA_DIR;
  it.skipIf(!real || !existsSync(join(real, "0-four-speakers-zh.wav")))(
    "separa 4 vozes reais",
    async () => {
      const d = real as string;
      process.env.OUVE_DIARIZATION_PATH = join(d, "sherpa-onnx-offline-speaker-diarization");
      process.env.OUVE_SEGMENTATION_MODEL = join(d, "segmentation.onnx");
      const userData = await mkdtemp(join(tmpdir(), "ouve-real-"));
      const svc = new LocalAiService({
        userDataDir: userData,
        tempDir: tmpdir(),
        platform: "linux",
        threads: 1,
        fetch,
        openInstaller: async () => undefined
      });
      const { mkdir, copyFile } = await import("node:fs/promises");
      await mkdir(join(userData, "local-ai", "falantes"), { recursive: true });
      await copyFile(join(d, "3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx"), svc.speakerModelPath("campplus"));
      const progress: number[] = [];
      const turns = await svc.diarize(join(d, "0-four-speakers-zh.wav"), { model: "campplus", speakers: 4, threads: 1 }, (p) =>
        progress.push(p)
      );
      expect(new Set(turns.map((t) => t.label)).size).toBe(4);
      expect(progress.at(-1)).toBe(100);
    },
    60_000
  );
});
