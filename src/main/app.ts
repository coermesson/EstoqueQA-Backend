import { pool } from "../database.js";
import { createApp } from "../app.js";

export const app = createApp(pool);
