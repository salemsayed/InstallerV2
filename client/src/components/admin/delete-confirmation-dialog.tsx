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
import { Loader } from "lucide-react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number | null;
  userName: string;
  onSuccess?: () => void;
}

export default function DeleteConfirmationDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: DeleteConfirmationDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!userId) return;

    setIsDeleting(true);

    try {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      const data = await res.json();

      if (data.success) {
        toast({
          title: "تم حذف المستخدم بنجاح",
          description: "تم حذف المستخدم من النظام",
        });

        // Invalidate users query
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "فشل حذف المستخدم",
          description: data.message || "حدث خطأ أثناء حذف المستخدم",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل حذف المستخدم",
        description: "حدث خطأ أثناء حذف المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
                <Loader className="ml-2 h-4 w-4 animate-spin" />
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