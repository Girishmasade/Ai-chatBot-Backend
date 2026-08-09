import redis from "redis";
import { redisUrl } from "../env/env.import.js";

const redisClient = redis.createClient({
    url: redisUrl
})

redisClient.on("connect", () => {
    console.log("Redis client connected")
})

redisClient.on("error", (err) => {
    console.log("Redis client error", err)
})

export default redisClient