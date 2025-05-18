import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2 } from "lucide-react";

interface DeleteConfirmationDialogProps {
  userId: number | null;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DeleteConfirmationDialog({
  userId,
  userName,
  isOpen,
  onClose,
  onSuccess,
}: DeleteConfirmationDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const { user: authUser } = useAuth();
  
  console.log("DeleteConfirmationDialog rendered with:", { isOpen, userId, userName });

  const handleDelete = async () => {
    if (!userId) return;

    setIsDeleting(true);

    try {
      const adminId = authUser?.id;
      
      if (!adminId) {
        throw new Error("لم يتم العثور على بيانات المسؤول");
      }
      
      const res = await apiRequest(
        "DELETE", 
        `/api/admin/users/${userId}?userId=${adminId}`
      );
      
      const data = await res.json();

      if (data.success) {
        toast({
          title: "تم الحذف بنجاح",
          description: "تم حذف المستخدم من النظام",
        });

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });

        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        toast({
          title: "فشلت عملية الحذف",
          description: data.message || "حدث خطأ أثناء حذف المستخدم",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "فشلت عملية الحذف",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>هل أنت متأكد من حذف هذا المستخدم؟</AlertDialogTitle>
          <AlertDialogDescription>
            أنت على وشك حذف المستخدم "{userName}". هذا الإجراء لا يمكن التراجع عنه.
            سيتم حذف جميع بيانات المستخدم بشكل نهائي.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الحذف...
              </>
            ) : (
              "حذف المستخدم"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}