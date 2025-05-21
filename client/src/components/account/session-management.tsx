import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import { arEG } from "date-fns/locale";
import { Loader2, LogOut, Smartphone, Laptop, Trash2 } from "lucide-react";
import { useState } from "react";

// Session type definition for the data returned from the API
interface Session {
  sessionId: string;
  createdAt: string;
  lastActive: string;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
}

export function SessionManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch all active sessions
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/auth/sessions'],
    retry: 1,
  });

  // Extract sessions from the response
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];

  // Mutation to delete a session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setIsDeleting(sessionId);
      return await apiRequest(`/api/auth/sessions/${sessionId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "تم إنهاء الجلسة بنجاح",
      });
      // Invalidate sessions query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      setIsDeleting(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في إنهاء الجلسة. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
      setIsDeleting(null);
    },
  });

  // Helper function to determine device icon based on user agent
  const getDeviceIcon = (userAgent?: string) => {
    // Handle undefined or null userAgent
    if (!userAgent) {
      return <Laptop className="h-4 w-4 mx-1" />;
    }
    
    const isMobile = 
      userAgent.includes('Mobile') || 
      userAgent.includes('Android') || 
      userAgent.includes('iPhone');
    
    return isMobile ? <Smartphone className="h-4 w-4 mx-1" /> : <Laptop className="h-4 w-4 mx-1" />;
  };

  // Helper function to format session type based on session ID
  const getSessionType = (sessionId: string) => {
    if (sessionId.startsWith('wasage_')) {
      return "واتساب";
    } else if (sessionId.startsWith('sms_')) {
      return "الرسائل النصية";
    } else {
      return "تسجيل دخول";
    }
  };

  // Error and loading states
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>إدارة الجلسات</CardTitle>
          <CardDescription>تعذر تحميل الجلسات النشطة. يرجى المحاولة مرة أخرى لاحقاً.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>إدارة الجلسات</CardTitle>
          <CardDescription>جاري تحميل الجلسات النشطة...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>إدارة الجلسات</CardTitle>
        <CardDescription>عرض وإدارة جميع جلسات تسجيل الدخول النشطة</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <div className="space-y-4">
            {sessions.map((session: Session) => (
              <div key={session.sessionId} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center space-x-4 space-x-reverse">
                  {getDeviceIcon(session.userAgent)}
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none flex items-center">
                      {getSessionType(session.sessionId)}
                      {session.isCurrent && (
                        <span className="mr-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          الجلسة الحالية
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      آخر نشاط: {formatDistance(new Date(session.lastActive), new Date(), { addSuffix: true, locale: arEG })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      تاريخ التسجيل: {new Date(session.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => deleteSessionMutation.mutate(session.sessionId)}
                  disabled={isDeleting === session.sessionId}
                >
                  {isDeleting === session.sessionId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : session.isCurrent ? (
                    <LogOut className="h-3 w-3" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  {session.isCurrent ? "تسجيل الخروج" : "إنهاء الجلسة"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">لا توجد جلسات نشطة</p>
        )}
      </CardContent>
    </Card>
  );
}