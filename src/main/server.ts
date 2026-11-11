import { app } from "./app.js";

const porta = Number(process.env.PORT ?? 3000);

async function iniciarServidor() {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET é obrigatório e deve ter pelo menos 32 caracteres.");
    }
    await app.listen({ port: porta });

    console.log(`Servidor iniciado em http://localhost:${porta}`);
  } catch (erro) {
    console.error("Erro ao iniciar o servidor:", erro);
    process.exit(1);
  }
}

iniciarServidor();
