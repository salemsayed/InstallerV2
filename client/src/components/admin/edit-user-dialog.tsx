import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2 } from "lucide-react";
import type { User } from "@shared/schema";
import { UserStatus } from "@shared/schema";

// Form schema
const formSchema = z.object({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  phone: z.string().min(10, { message: "يرجى إدخال رقم هاتف صحيح" }),
  region: z.string().optional(),
  status: z.string(),
  points: z.coerce.number().int().min(0, { message: "يجب أن تكون النقاط رقم صحيح موجب" }),
});

interface EditUserDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditUserDialog({ 
  user, 
  isOpen, 
  onClose,
  onSuccess 
}: EditUserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: authUser } = useAuth();
  
  console.log("EditUserDialog rendered with:", { isOpen, userId: user?.id, userName: user?.name });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      region: user?.region || "",
      status: user?.status || UserStatus.ACTIVE,
      points: user?.points || 0,
    },
  });
  
  // Reset form when user changes
  useEffect(() => {
    if (user && isOpen) {
      form.reset({
        name: user.name || "",
        phone: user.phone || "",
        region: user.region || "",
        status: user.status || UserStatus.ACTIVE,
        points: user.points || 0,
      });
    }
  }, [user, isOpen, form]);
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      const adminId = authUser?.id;
      
      if (!adminId) {
        throw new Error("لم يتم العثور على بيانات المسؤول");
      }
      
      const res = await apiRequest(
        "PATCH", 
        `/api/admin/users/${user.id}?userId=${adminId}`, 
        values
      );
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تم تحديث البيانات بنجاح",
          description: "تم تحديث بيانات المستخدم بنجاح",
        });
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        toast({
          title: "حدث خطأ",
          description: data.message || "حدث خطأ أثناء تحديث البيانات",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "حدث خطأ",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">تعديل بيانات المستخدم</DialogTitle>
          <DialogDescription>
            قم بتعديل بيانات المستخدم ثم اضغط على حفظ لتأكيد التغييرات
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block font-semibold">الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input 
                        className="focus:ring-2 focus:ring-primary/20"
                        placeholder="أدخل اسم المستخدم" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block font-semibold">رقم الهاتف</FormLabel>
                    <FormControl>
                      <Input 
                        className="focus:ring-2 focus:ring-primary/20"
                        placeholder="مثال: 01012345678 أو +201012345678" 
                        type="tel" 
                        dir="ltr"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block font-semibold">المنطقة</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="اختر المنطقة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="riyadh">الرياض</SelectItem>
                          <SelectItem value="jeddah">جدة</SelectItem>
                          <SelectItem value="dammam">الدمام</SelectItem>
                          <SelectItem value="cairo">القاهرة</SelectItem>
                          <SelectItem value="alexandria">الإسكندرية</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block font-semibold">الحالة</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UserStatus.ACTIVE}>نشط</SelectItem>
                          <SelectItem value={UserStatus.PENDING}>معلق</SelectItem>
                          <SelectItem value={UserStatus.INACTIVE}>غير نشط</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block font-semibold">النقاط</FormLabel>
                    <FormControl>
                      <Input 
                        className="focus:ring-2 focus:ring-primary/20"
                        placeholder="أدخل عدد النقاط" 
                        type="number"
                        min={0}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="mt-6 flex justify-between">
              <Button 
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-300 hover:bg-gray-100"
              >
                إلغاء
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  "حفظ التغييرات"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}