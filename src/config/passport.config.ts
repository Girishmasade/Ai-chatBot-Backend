import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type Profile as GoogleProfile,
} from "passport-google-oauth20";
import {
  Strategy as GithubStrategy,
  type Profile as GithubProfile,
} from "passport-github2";
import {
  Strategy as FacebookStrategy,
  type Profile as FacebookProfile,
} from "passport-facebook";

import {
  googleClientId,
  googleSecret,
  facebookClientId,
  facebookSecret,
  githubClientId,
  githubSecret,
  googleFallbackUrl,
  githubFallbackUrl,
  facebookFallbackUrl,
} from "../env/env.import.js";
import { AuthModel } from "@/moduels/auth/auth.models.js";

passport.serializeUser((user: any, done) => { // store user id in session
  done(null, user.id); // store ID
});

passport.deserializeUser(async(id, done) => { // retrive user from database
 try {
    const user = await AuthModel.findById(id);
    done(null, user as any);
 } catch (error) {
    done(error, null);
 }
});

// google

passport.use(
  new GoogleStrategy(
    {
    clientID: googleClientId,
    clientSecret: googleSecret,
    callbackURL: googleFallbackUrl,
  },
  async (accessToken: string, refreshToken: string, profile: GoogleProfile, done: (error: any, user?: any) => void) => {
    try {
      let user = await AuthModel.findOne({ googleId: profile.id });
      if (user) {
        return done(null, user);
      }
      
      const email = profile.emails?.[0].value;
      if (email) {
        user = await AuthModel.findOne({ email });
        if (user) {
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }
      }

      const newUser = new AuthModel({
        googleId: profile.id,
        username: profile.displayName || "GoogleUser",
        email: email,
        avatar: profile.photos?.[0].value,
        isVerified: true,
      });
      await newUser.save();
      done(null, newUser);
    } catch (error) {
      done(error, null);
    }
  }
));

// github

passport.use(
    new GithubStrategy({
        clientID: githubClientId,
        clientSecret: githubSecret,
        callbackURL: githubFallbackUrl,
    },
    async (accessToken: string, refreshToken: string, profile: GithubProfile, done: (error: any, user?: any) => void) => {
        try {
            let user = await AuthModel.findOne({ githubId: profile.id });
            if (user) {
                return done(null, user);
            }
            
            const email = profile.emails?.[0].value;
            if (email) {
              user = await AuthModel.findOne({ email });
              if (user) {
                user.githubId = profile.id;
                user.isVerified = true;
                await user.save();
                return done(null, user);
              }
            }

            const newUser = new AuthModel({
                githubId: profile.id,
                username: profile.displayName || profile.username || "GithubUser",
                email: email,
                avatar: profile.photos?.[0].value,
                isVerified: true,
            })
            await newUser.save();
            done(null, newUser);
        } catch (error) {
            done(error, null)
        }
    }
))

// facebook

passport.use(
  new FacebookStrategy(
    {
      clientID: facebookClientId,
      clientSecret: facebookSecret,
      callbackURL: facebookFallbackUrl,
      profileFields: ["id", "emails", "name", "picture.type(large)"],
    },
    async (_accessToken, _refreshToken, profile: FacebookProfile, done: (error: any, user?: any) => void) => {
      try {
        let user = await AuthModel.findOne({ facebookId: profile.id });
        if (user) {
          return done(null, user);
        }
        
        const email = profile.emails?.[0].value;
        if (email) {
          user = await AuthModel.findOne({ email });
          if (user) {
            user.facebookId = profile.id;
            user.isVerified = true;
            await user.save();
            return done(null, user);
          }
        }

        const newUser = new AuthModel({
          facebookId: profile.id,
          username: profile.displayName || `${profile.name?.givenName} ${profile.name?.familyName}`.trim() || "FacebookUser",
          email: email,
          avatar: profile.photos?.[0].value,
          isVerified: true,
        });
        await newUser.save();
        done(null, newUser);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  )
);

export default passport;