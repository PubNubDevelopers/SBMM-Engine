import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const port = Number(PORT) || 3001; // Ensure it's a number

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Accessible at: http://<your-ec2-public-ip>:${port}`);
});

// Allow all origins with CORS
app.use(cors());
app.use(express.json());
app.use("/", router);

// Export app without starting the server
export default app;
export { PORT };