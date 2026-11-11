
import { pool } from "../src/database.js";

async function testarConexao() {
  try {
    const resultado = await pool.query(
      "SELECT current_database() AS banco, NOW() AS horario"
    );

    console.log("Conexão com PostgreSQL realizada com sucesso!");
    console.log(resultado.rows[0]);
  } catch (erro) {
    console.error("Falha na conexão com PostgreSQL:", erro);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testarConexao();
