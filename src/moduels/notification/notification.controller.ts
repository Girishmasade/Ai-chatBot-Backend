import type {Request, Response, NextFunction} from "express"

export const sendNotification = async(req: Request, res:Response, next:NextFunction) => {
    try {
    } catch (error) {
        console.error("error to send Notification :", error);
        next(error)
    }
}

export const getAllNotification = async() => {

}

export const getNotificationById = async() => {

}

export const markNotificationAsRead = async() => {

}

export const markAllNotificationsAsRead = async() => {

}

export const deleteNotification = async() => {

}
