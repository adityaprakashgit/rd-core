import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Checking auditLog model in Prisma Client...");
  console.log("Models:", Object.keys(prisma).filter(k => !k.startsWith("$") && !k.startsWith("_")));
  
  if ("auditLog" in prisma) {
    console.log("✅ auditLog exists!");
  } else if ("auditLogs" in prisma) {
    console.log("✅ auditLogs exists!");
  } else {
    console.log("❌ auditLog does NOT exist.");
  }
}

main().catch(console.error);
