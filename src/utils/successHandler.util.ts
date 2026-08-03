import { type Response } from "express";

export const successHandler = (
    res: Response,
    status: Number,
    success: Boolean,
    message: String,
    data: Record<string, unknown> = {} // record is used to store key-value pairs
) => {
    return res.status(Number(status)).json({
        success,
        message,
        data
    })
}