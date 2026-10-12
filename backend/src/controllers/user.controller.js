import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";

const syncUser = async (req, res) => {
  try {
    const supabaseUser = req.supabaseUser;
    if (!supabaseUser) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "User not authenticated" });
    }

    const { id: supabaseId, email } = supabaseUser;
    const metadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};

    const name = req.body.name || metadata.full_name || metadata.name || "";
    const avatarUrl =
      req.body.avatarUrl || metadata.avatar_url || metadata.picture || "";
    const rawProvider = req.body.provider || appMetadata.provider || "google";
    const providerName = rawProvider === "azure" ? "azure" : "google";
    const providerId =
      req.body.providerId ||
      supabaseUser.identities?.[0]?.id ||
      supabaseId;
    const credentials = req.body.credentials;

    let user = await User.findOne({ supabaseId });

    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    const providerData = {
      provider: providerName,
      providerId: String(providerId),
      lastLoginAt: new Date(),
    };

    if (user) {
      user.supabaseId = supabaseId;
      if (email) user.email = email.toLowerCase();
      if (name) user.name = name;
      if (avatarUrl) user.avatarUrl = avatarUrl;

      const existingProviderIndex = user.providers.findIndex(
        (p) => p.provider === providerData.provider
      );

      if (existingProviderIndex >= 0) {
        user.providers[existingProviderIndex].lastLoginAt = new Date();
        user.providers[existingProviderIndex].providerId = String(providerId);
      } else {
        user.providers.push(providerData);
      }

      if (credentials) {
        user.credentials = credentials;
      }

      await user.save();
    } else {
      user = new User({
        supabaseId,
        email: email ? email.toLowerCase() : "",
        name,
        avatarUrl,
        role: "user",
        providers: [providerData],
        ...(credentials && { credentials }),
      });
      await user.save();
    }

    return res.status(httpStatus.OK).json({
      message: "User synced successfully",
      user,
    });
  } catch (error) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Sync failed: ${error.message}` });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const user =
      req.user ||
      (req.supabaseUser &&
        (await User.findOne({ supabaseId: req.supabaseUser.id })));

    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User not found" });
    }

    const meetings = await Meeting.find({
      $or: [
        { user_id: user.supabaseId },
        { user_id: user.email },
        { user_id: user.name },
      ],
    }).sort({ date: -1 });

    return res.status(httpStatus.OK).json(meetings);
  } catch (e) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong: ${e.message}` });
  }
};

const addToHistory = async (req, res) => {
  const { meeting_code } = req.body;
  if (!meeting_code) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Meeting code is required" });
  }

  try {
    const user =
      req.user ||
      (req.supabaseUser &&
        (await User.findOne({ supabaseId: req.supabaseUser.id })));

    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User not found" });
    }

    const newMeeting = new Meeting({
      user_id: user.supabaseId,
      meetingCode: meeting_code,
    });

    await newMeeting.save();
    return res
      .status(httpStatus.CREATED)
      .json({ message: "Added code to History" });
  } catch (e) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong: ${e.message}` });
  }
};

const login = async (req, res) => {
  return res.status(httpStatus.BAD_REQUEST).json({
    message: "Legacy login deprecated. Please authenticate through Supabase.",
  });
};

const register = async (req, res) => {
  return res.status(httpStatus.BAD_REQUEST).json({
    message: "Legacy register deprecated. Please authenticate through Supabase.",
  });
};
export { syncUser, getUserHistory, addToHistory, login, register };
