import { Schema, model } from "mongoose";

const providerSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["google", "azure"],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const credentialsSchema = new Schema(
  {
    providerAccessToken: {
      type: String,
      select: false,
    },
    providerRefreshToken: {
      type: String,
      select: false,
    },
    tokenExpiresAt: {
      type: Date,
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    supabaseId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    providers: [providerSchema],
    credentials: credentialsSchema,
  },
  {
    timestamps: true,
  }
);

const User = model("User", userSchema);

export { User };
