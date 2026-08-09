export interface JwtPayload {
  userId: string;
  role: string;
  email: string;
  username: string;
  avatar: string;
  isVerified: boolean;
}

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  username: string;
  avatar: string;
  googleId?: string;
  githubId?: string;
  facebookId?: string;
  isVerified: boolean;
}