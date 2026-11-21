import { describe, expect, it } from "vitest";
import { canTransitionSession, transitionSession, type Session } from "../src/domain/session.js";

describe("session state machine", () => {
  it("allows a session to move from idle to preparing and capturing", () => {
    const session: Session = { id: "s-1", title: "Test", status: "idle" };
    const preparing = transitionSession(session, "preparing");
    const capturing = transitionSession(preparing, "capturing");

    expect(capturing.status).toBe("capturing");
    expect(capturing.startedAt).toBeTypeOf("number");
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionSession("idle", "completed")).toBe(false);
    const session: Session = { id: "s-1", title: "Test", status: "idle" };
    expect(() => transitionSession(session, "completed")).toThrow();
  });
});
