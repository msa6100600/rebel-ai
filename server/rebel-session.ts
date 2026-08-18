import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { verifyRebelSession } from "./rebel-auth";

export function rebelTokenFromRequest(req: TrpcContext["req"]) {
  const authorization = req.headers.authorization;
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

export async function requireRebelAccount(req: TrpcContext["req"]) {
  const session = verifyRebelSession(rebelTokenFromRequest(req));
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "سجّل الدخول إلى حسابك للمتابعة." });
  const account = await db.getRebelAccountById(session.accountId);
  if (!account || account.username !== session.username) throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت الجلسة أو لم يعد الحساب متاحاً." });
  return account;
}

export const publicAccount = (account: { id: number; username: string; displayName: string; role: "user" | "owner" }) => ({
  id: account.id,
  username: account.username,
  displayName: account.displayName,
  role: account.role,
});
