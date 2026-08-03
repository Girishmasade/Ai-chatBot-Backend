import mongoose from "mongoose"
import { MONGO_URI } from "../env/env.import.js"

export const connectDb = async () => {
    try {
        const connection = await mongoose.connect(MONGO_URI)
        console.log(`Database connected: ${connection.connection.host}`)
    } catch (error) {
        console.log(error)
        process.exit(1)
    }
}