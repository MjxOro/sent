// components/Dashboard/NotificationWrapper.tsx
import { ReactNode } from "react";
import { NotificationType } from "@/stores/notificationStore";
import { useNotificationStore } from "@/stores/notificationStore";

interface NotificationWrapperProps {
  children: ReactNode;
  type?: NotificationType;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  size?: "sm" | "md" | "lg";
  threadId?: string;
  showCount?: boolean;
}

const NotificationWrapper = ({
  children,
  type = "chat_invite",
  position = "top-right",
  size = "sm",
  threadId,
  showCount = true,
}: NotificationWrapperProps) => {
  const { getNotificationsByType, markAllAsRead } = useNotificationStore();

  // Get notifications for this type
  const notifications = getNotificationsByType(type);

  // Filter notifications by threadId if it exists
  const filteredNotifications = threadId
    ? notifications.filter((n) => n.data?.roomId === threadId)
    : notifications;

  const unreadCount = filteredNotifications.length;

  const positionClasses = {
    "top-right": "-top-1 -right-1",
    "top-left": "-top-1 -left-1",
    "bottom-right": "-bottom-1 -right-1",
    "bottom-left": "-bottom-1 -left-1",
  };

  const sizeClasses = {
    sm: "min-w-[16px] h-4 text-xs",
    md: "min-w-[20px] h-5 text-sm",
    lg: "min-w-[24px] h-6 text-base",
  };

  return (
    <div className="relative inline-block">
      {children}
      {unreadCount > 0 && (
        <div
          className={`absolute ${positionClasses[position]} ${sizeClasses[size]} 
            bg-red-500 rounded-full flex items-center justify-center px-1
            text-white font-medium leading-none`}
        >
          {showCount ? (unreadCount > 99 ? "99+" : unreadCount) : ""}
        </div>
      )}
    </div>
  );
};

export default NotificationWrapper;
