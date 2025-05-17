// components/notifications/NotificationWrapper.tsx
import { ReactNode } from "react";
import { NotificationType } from "@/stores/notificationStore";
import { useNotificationStore } from "@/stores/notificationStore";

interface NotificationWrapperProps {
  children: ReactNode;
  type?: NotificationType; // Accept multiple types
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  size?: "sm" | "md" | "lg";
}

const NotificationWrapper = ({
  children,
  type = "chat_invite",
  position = "top-right",
  size = "sm",
}: NotificationWrapperProps) => {
  // un
  const { getNotificationsByType } = useNotificationStore();
  const notifications = getNotificationsByType(type);
  const unreadCount = notifications.length;

  const positionClasses = {
    "top-right": "-top-1 -right-1",
    "top-left": "-top-1 -left-1",
    "bottom-right": "-bottom-1 -right-1",
    "bottom-left": "-bottom-1 -left-1",
  };

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div className="relative inline-block">
      {children}
      {unreadCount > 0 && (
        <div
          className={`absolute ${positionClasses[position]} ${sizeClasses[size]} bg-red-500 rounded-full`}
        />
      )}
    </div>
  );
};

export default NotificationWrapper;
