import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { notificationService, Notification } from "@/services/notificationService";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!user) {
      // Clear notifications when user logs out
      setNotifications([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    // Load initial data
    loadNotifications();

    // Subscribe to real-time notifications
    try {
      unsubscribe = notificationService.subscribeToNotifications(user.id, (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev]);
      });
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from notifications:", error);
        }
      }
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const notifs = await notificationService.getNotifications(user.id);
      setNotifications(notifs);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const success = await notificationService.markAsRead(notificationId);
    if (!success) {
      toast.error("Could not mark notification as read");
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    const success = await notificationService.markAllAsRead(user.id);
    if (!success) {
      toast.error("Could not mark all notifications as read");
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleDelete = async (notificationId: string) => {
    const success = await notificationService.deleteNotification(notificationId);
    if (!success) {
      toast.error("Could not delete notification");
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    toast.success("Notification deleted");
  };

  const handleDeleteAllRead = async () => {
    if (!user) return;

    const success = await notificationService.deleteAllRead(user.id);
    if (!success) {
      toast.error("Could not clear read notifications");
      return;
    }

    setNotifications((prev) => prev.filter((n) => !n.read));
    toast.success("All read notifications deleted");
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.metadata?.routePath) {
      navigate(notification.metadata.routePath, {
        state: { entrySource: "notification_open" },
      });
    } else if (notification.metadata?.courseId) {
      navigate(`/courses/${notification.metadata.courseId}`, {
        state: { entrySource: "notification_open" },
      });
    } else if (notification.metadata?.submissionId) {
      navigate("/dashboard");
    } else if (notification.metadata?.certificateId) {
      navigate("/certificates");
    } else {
      toast.info("This notification has no linked record to open yet.");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "course_completed":
        return "🎓";
      case "certificate_issued":
        return "🏆";
      case "submission_approved":
        return "✅";
      case "submission_rejected":
        return "❌";
      case "submission_revision_requested":
        return "🔄";
      case "enrollment_confirmed":
        return "📚";
      case "feedback_received":
        return "💬";
      case "assessment_graded":
        return "📝";
      case "account_verified":
        return "✅";
      case "course_assigned":
        return "🎯";
      case "system_announcement":
        return "📢";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "course_completed":
      case "certificate_issued":
      case "submission_approved":
      case "account_verified":
        return "text-green-600 dark:text-green-400";
      case "submission_rejected":
        return "text-red-600 dark:text-red-400";
      case "submission_revision_requested":
        return "text-yellow-600 dark:text-yellow-400";
      case "course_assigned":
      case "system_announcement":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-2">
              Stay updated with your learning progress and activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
            {notifications.some((n) => n.read) && (
              <Button variant="outline" onClick={handleDeleteAllRead}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear read
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {notifications.length - unreadCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b">
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            onClick={() => setFilter("all")}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "ghost"}
            onClick={() => setFilter("unread")}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Unread ({unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground text-center mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "You'll see notifications here when you receive them"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  !notification.read && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("text-3xl", getNotificationColor(notification.type))}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-base mb-1",
                              !notification.read && "font-semibold"
                            )}
                          >
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                            <span>•</span>
                            <span>{format(new Date(notification.createdAt), "MMM dd, yyyy HH:mm")}</span>
                          </div>
                        </div>
                        {!notification.read && (
                          <Badge variant="default" className="ml-2">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notifications;

