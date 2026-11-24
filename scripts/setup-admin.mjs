// Cria o usuário administrador no build (npm run build), se ainda não existir.
//   ADMIN_EMAIL (obrigatório), ADMIN_PASSWORD (10+ caracteres), ADMIN_NAME (opcional)
// Sem ADMIN_PASSWORD, gera uma senha aleatória e mostra UMA vez no log do build.
// Se o usuário já existe, só garante o papel de ADMIN: a senha não é alterada
// (troque em Meus dados ou em "Esqueci a senha"). Para forçar a senha do .env: ADMIN_RESET_PASSWORD=1.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.log("ℹ ADMIN_EMAIL não definido: nenhum admin criado.");
  process.exit(0);
}

let password = process.env.ADMIN_PASSWORD || "";
if (password && password.length < 10) {
  console.error("✗ ADMIN_PASSWORD precisa ter 10 ou mais caracteres.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const data = { role: "ADMIN", status: "ACTIVE" };
    if (process.env.ADMIN_RESET_PASSWORD === "1" && password) data.passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`✓ Admin ok: ${email}${data.passwordHash ? " (senha redefinida)" : ""}`);
  } else {
    const generated = !password;
    if (generated) password = randomBytes(9).toString("base64url");
    await prisma.user.create({
      data: { email, name: process.env.ADMIN_NAME || "Administrador", passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
    });
    console.log(`✓ Admin criado: ${email}${generated ? ` / senha: ${password}  (anote agora: ela não será mostrada de novo)` : ""}`);
  }
} finally {
  await prisma.$disconnect();
}
