import { PrismaClient } from "@prisma/client";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

export const prisma = (() => {
  if (isBuildPhase) {
    // Avoid instantiating Prisma during Next build when the generated client may be unavailable.
    return {} as PrismaClient;
  }

  const client =
    global.prisma ||
    new PrismaClient({
      log: ["error"]
    });

  if (process.env.NODE_ENV !== "production") {
    global.prisma = client;
  }

  return client;
})();
