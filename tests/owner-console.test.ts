import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";

describe("owner console gate", () => {
  it("accepts the securely configured owner password without exposing it", async () => {
    const configuredPassword = process.env.OWNER_CONSOLE_PASSWORD;
    expect(configuredPassword).toBeTruthy();
    const caller = appRouter.createCaller({} as never);
    const result = await caller.owner.unlock({ password: configuredPassword! });
    expect(result.granted).toBe(true);
  });

  it("rejects an unrelated password", async () => {
    const caller = appRouter.createCaller({} as never);
    const result = await caller.owner.unlock({ password: "not-the-owner-password" });
    expect(result.granted).toBe(false);
  });

  it("accepts the Rebel Ai username and configured password together", async () => {
    const caller = appRouter.createCaller({} as never);
    const result = await caller.owner.login({ username: "Rebel Ai", password: process.env.OWNER_CONSOLE_PASSWORD! });
    expect(result.granted).toBe(true);
  });

  it("creates an application session for the configured Rebel Ai owner credentials", async () => {
    const caller = appRouter.createCaller({} as never);
    const result = await caller.account.login({ identity: "Rebel Ai", password: process.env.OWNER_CONSOLE_PASSWORD! });
    expect(result.account.username).toBe("rebelai");
    expect(result.account.role).toBe("owner");
    expect(result.token.length).toBeGreaterThan(20);
  }, 30_000);

  it("rejects the retired owner username", async () => {
    const caller = appRouter.createCaller({} as never);
    const result = await caller.owner.login({ username: "rebal ai owner", password: process.env.OWNER_CONSOLE_PASSWORD! });
    expect(result.granted).toBe(false);
  });
});
