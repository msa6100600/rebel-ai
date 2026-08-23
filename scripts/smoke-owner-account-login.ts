import { appRouter } from "../server/routers";

async function main() {
  const configuredPassword = process.env.OWNER_CONSOLE_PASSWORD;
  if (!configuredPassword) throw new Error("OWNER_CONSOLE_PASSWORD is not configured");

  const caller = appRouter.createCaller({} as never);
  const result = await caller.account.login({ identity: "Rebel Ai", password: configuredPassword });
  if (!result.token || result.account.role !== "owner" || result.account.username !== "rebelai") {
    throw new Error("Owner account login did not create a valid owner session");
  }

  let documentedPasswordWorks = false;
  try {
    await caller.account.login({ identity: "Rebel Ai", password: "Rebel_Ai" });
    documentedPasswordWorks = true;
  } catch {
    documentedPasswordWorks = false;
  }

  console.log(JSON.stringify({ ownerLogin: "passed", documentedPasswordWorks }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
