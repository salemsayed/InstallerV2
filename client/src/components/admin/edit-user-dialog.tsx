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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { User, UserStatus } from "@shared/schema";

// Form schema for editing users
const formSchema = z.object({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  phone: z.string().min(10, { message: "يرجى إدخال رقم هاتف صحيح" }),
  region: z.string().optional(),
  status: z.nativeEnum(UserStatus),
  points: z.coerce.number().int().min(0),
});

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditUserDialog({ 
  user, 
  open, 
  onOpenChange,
  onSuccess 
}: EditUserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      region: "",
      status: UserStatus.ACTIVE,
      points: 0,
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        phone: user.phone || "",
        region: user.region || "",
        status: user.status as UserStatus,
        points: user.points,
      });
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}`, values);
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تم تحديث بيانات المستخدم بنجاح",
          description: "تم تحديث بيانات المستخدم",
        });
        
        // Invalidate users query to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
        
        if (onSuccess) {
          onSuccess();
        }
        
        onOpenChange(false);
      } else {
        toast({
          title: "فشل تحديث بيانات المستخدم",
          description: data.message || "حدث خطأ أثناء تحديث بيانات المستخدم",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل تحديث بيانات المستخدم",
        description: "حدث خطأ أثناء تحديث بيانات المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">تعديل بيانات المستخدم</DialogTitle>
          <DialogDescription>
            قم بتعديل بيانات المستخدم ثم اضغط على حفظ لتأكيد التغييرات.
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
                        className="focus:ring-2 focus:ring-primary/20 transition-all duration-200"
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
                        className="focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        placeholder="مثال: 01012345678" 
                        type="tel" 
                        {...field} 
                        dir="ltr"
                        value={field.value || ""}
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
                      >
                        <FormControl>
                          <SelectTrigger className="focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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
                      >
                        <FormControl>
                          <SelectTrigger className="focus:ring-2 focus:ring-primary/20 transition-all duration-200">
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
                        className="focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        placeholder="أدخل عدد النقاط" 
                        type="number" 
                        {...field}
                        min={0}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="mt-6 pt-4 border-t flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-gray-300 hover:bg-gray-100 transition-colors duration-200"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300 shadow-md hover:shadow-lg"
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