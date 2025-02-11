import { Router } from "express";
import { handleMatchmakingRequest } from "./player";

const router = Router();

router.post("/matchmaking", handleMatchmakingRequest);

export default router;