import mongoose from "mongoose"
import { MONGO_URI } from "../env/env.import.js"

export const connectDb = async () => {
    try {
        if (!MONGO_URI) {
            console.error("[Database] Error: MONGO_URI environment variable is missing!");
            return;
        }
        const connection = await mongoose.connect(MONGO_URI);
        console.log(`[Database] Connected: ${connection.connection.host}`);
    } catch (error) {
        console.error("[Database] Connection error:", error);
    }
}