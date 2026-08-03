import jwt from "jsonwebtoken";
import { type Response } from "express";
import redisClient from "@/config/redis.config.js";
import crypto from "crypto";
import type { Auth } from "../moduels/auth/auth.models.js";
import { jwtAccessSecret, node_env } from "@/env/env.import.js";

const ACCESS_TTL = 15 * 60; // 15 mins in seconds
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// jwt payload

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  avatar: string;
}

// redis keys

export const keys = {
  accessToken: (userId: string) => `access_token:${userId}`,
  refreshToken: (userId: string) => `refresh_token:${userId}`,
  userToken: (userId: string) => `user_token:${userId}`,
};

// generate the accesstoken

export const generateAccessToken = async (user: Auth) => {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
  };

  const token = jwt.sign(payload, jwtAccessSecret, { expiresIn: "15m" });

  await redisClient.setEx(
    keys.accessToken(user._id.toString()),
    ACCESS_TTL,
    token,
  );

  return token;
};

// generate the refreshtoken

export const generateRefreshToken = async (userId: string) => {
  const token = crypto.randomBytes(64).toString("hex");

  await redisClient.setEx(keys.refreshToken(token), REFRESH_TTL, userId);

  await redisClient.sAdd(keys.userToken(userId), token); // this is used to add int he set of user device if user login fro lap, com, tab, mobile
  await redisClient.expire(keys.userToken(userId), REFRESH_TTL);

  return token;
};

// validate refreshtoken

export const validateRefreshToken = async (
  token: string,
): Promise<string | null> => {
  return redisClient.get(keys.refreshToken(token));
};

// Delete single refresh token

export const deleteRefreshToken = async (token: string): Promise<void> => {
  const userId = await redisClient.get(keys.refreshToken(token));

  if (userId) {
    await redisClient.sRem(keys.userToken(userId), token); //it's used to remove one item from the set
  }

  await redisClient.del(keys.refreshToken(token));
};

// dlete refresh token

export const deleteRefreshTokenFromAllDevices = async (
  userId: string,
): Promise<void> => {

  const tokens: string[] = await redisClient.sMembers(keys.userToken(userId)); // get all items from the set 

  if (tokens.length > 0) {
    await Promise.all(tokens.map((t) => redisClient.del(keys.refreshToken(t))));
  }

  await redisClient.del(keys.accessToken(userId));
  await redisClient.del(keys.userToken(userId));
};

// set token as cokkies

export const setTokenCookies = (
  res: Response,
  refreshToken: string,
): void => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: node_env === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// clear token cookies

export const clearTokenCookies = (res: Response): void => {
   res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};
