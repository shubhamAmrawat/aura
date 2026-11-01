import { DeviceEventEmitter } from "react-native";

/** A good moment to offer notifications (after a first download, apply or save). */
export const ASK_NOTIFICATIONS = "aurora:askNotifications";
export const askForNotificationsSoon = () => DeviceEventEmitter.emit(ASK_NOTIFICATIONS);

/** The inbox was opened: the bell's badge goes to 0. */
export const NOTIFICATIONS_SEEN = "aurora:notificationsSeen";
