import { Router } from "express";
import {
  addToHistory,
  getUserHistory,
  login,
  register,
  syncUser,
} from "../controllers/user.controller.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/sync").post(verifyAuth, syncUser);
router.route("/add_to_activity").post(verifyAuth, addToHistory);
router.route("/get_all_activity").get(verifyAuth, getUserHistory);

// Legacy routes
router.route("/login").post(login);
router.route("/register").post(register);

export default router;