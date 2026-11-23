import { cpus, totalmem } from "node:os";
import { cpuBenchmark, recommendProfile, resolveProfile, threadsFor, type MachineInfo, type ProfileChoice } from "@ouve/providers";
import type { MachineReport } from "../shared/ipc.js";

const NVIDIA = 0x10de;
const AMD = 0x1002;

/** Placa de vídeo dedicada (NVIDIA ou AMD) nas informações básicas do Chromium. Só informativo. */
export function hasDedicatedGpu(info: unknown): boolean {
  const devices = (info as { gpuDevice?: Array<{ vendorId?: number }> } | undefined)?.gpuDevice ?? [];
  return devices.some((d) => d.vendorId === NVIDIA || d.vendorId === AMD);
}

/** Mede o computador uma vez por execução (memória, núcleos, teste rápido do processador). */
export class MachineProbe {
  private cached: MachineInfo | undefined;

  constructor(private readonly gpuInfo: () => Promise<unknown>) {}

  async measure(rerun = false): Promise<MachineInfo> {
    if (this.cached && !rerun) return this.cached;
    let dedicatedGpu = false;
    try {
      dedicatedGpu = hasDedicatedGpu(await this.gpuInfo());
    } catch {
      /* sem informação de vídeo */
    }
    this.cached = {
      ramGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
      cores: cpus().length,
      cpuScore: cpuBenchmark(),
      dedicatedGpu
    };
    return this.cached;
  }

  async report(choice: ProfileChoice, rerun = false): Promise<MachineReport> {
    const machine = await this.measure(rerun);
    const rec = recommendProfile(machine);
    const spec = resolveProfile(choice, machine);
    return { machine, recommended: rec.profile, reason: rec.reason, active: spec.id, threads: threadsFor(spec, machine.cores) };
  }
}
