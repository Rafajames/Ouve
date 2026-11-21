export type SessionStatus =
  | "idle"
  | "preparing"
  | "capturing"
  | "paused"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type CaptureSourceKind = "screen" | "window" | "browser-tab" | "audio-file" | "video-file";

export interface CaptureSource {
  id: string;
  kind: CaptureSourceKind;
  label: string;
  audioAvailable: boolean;
}

export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  source?: CaptureSource;
  startedAt?: number;
  endedAt?: number;
}

const transitions: Record<SessionStatus, readonly SessionStatus[]> = {
  idle: ["preparing", "cancelled"],
  preparing: ["capturing", "failed", "cancelled"],
  capturing: ["paused", "processing", "failed", "cancelled"],
  paused: ["capturing", "processing", "failed", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["preparing"],
  cancelled: []
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionSession(session: Session, next: SessionStatus): Session {
  if (!canTransitionSession(session.status, next)) {
    throw new Error(`Invalid session transition: ${session.status} -> ${next}`);
  }

  const now = Date.now();
  return {
    ...session,
    status: next,
    ...(next === "capturing" && session.startedAt === undefined ? { startedAt: now } : {}),
    ...(["completed", "failed", "cancelled"].includes(next) ? { endedAt: now } : {})
  };
}
