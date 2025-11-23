// prisma/seed.ts
import { prisma } from "../lib/prisma";

async function main() {
  const users = [
    { username: "pilot", password: "1234", role: "Pilot" },
    { username: "copilot", password: "1234", role: "CoPilot" },
    { username: "innovation", password: "1234", role: "InnovationLead" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    });
  }

  console.log("Seeded users ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
