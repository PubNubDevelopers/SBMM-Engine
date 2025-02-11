import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// Allow all origins with CORS
app.use(cors());
app.use(express.json());
app.use("/", router);

// Export app without starting the server
export default app;
export { PORT };