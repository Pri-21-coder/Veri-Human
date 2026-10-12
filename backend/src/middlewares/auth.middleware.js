import httpStatus from "http-status";
import { supabase } from "../config/supabase.js";
import { User } from "../models/user.model.js";

export const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query?.token) {
      token = req.query.token;
    } else if (req.body?.token) {
      token = req.body.token;
    }

    if (!token) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Authorization token required" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid or expired authorization token" });
    }

    req.supabaseUser = data.user;
    req.user = await User.findOne({ supabaseId: data.user.id });

    next();
  } catch (error) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Authentication error: ${error.message}` });
  }
};
