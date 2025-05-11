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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { insertUserSchema, UserRole, UserStatus } from "@shared/schema";

// Extend the schema to make the form fields required
const formSchema = insertUserSchema.extend({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  phone: z.string().min(11, { message: "يجب أن يكون رقم الهاتف صحيح" }),
  region: z.string().min(1, { message: "يرجى اختيار المنطقة" }),
  role: z.nativeEnum(UserRole, { 
    message: "يرجى اختيار نوع المستخدم"
  }),
});

interface InviteFormProps {
  onSuccess?: () => void;
}

export default function InviteForm({ onSuccess }: InviteFormProps) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      region: "",
      role: "installer", // String value of UserRole.INSTALLER
      status: "active", // String value of UserStatus.ACTIVE
      points: 0,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      // Get admin ID from auth context
      const adminId = authUser?.id;
      
      if (!adminId) {
        throw new Error("لم يتم العثور على بيانات المدير");
      }
      
      const res = await apiRequest("POST", `/api/admin/users?userId=${adminId}`, values);
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تمت إضافة المستخدم بنجاح",
          description: "تم إضافة المستخدم إلى النظام",
        });
        
        // Reset form
        form.reset({
          name: "",
          phone: "",
          region: "",
          role: "installer",
          status: "active",
          points: 0,
        });
        
        // Invalidate users query to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "فشل إضافة المستخدم",
          description: data.message || "حدث خطأ أثناء إضافة المستخدم",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل إضافة المستخدم",
        description: "حدث خطأ أثناء إضافة المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-md border border-gray-100 mb-6 bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-xl font-bold text-primary">إضافة مستخدم جديد</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        placeholder="مثال: 01012345678 أو +201012345678" 
                        type="tel" 
                        {...field} 
                        dir="ltr"
                        title="رقم الهاتف يمكن أن يبدأ بـ 01 أو +201"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block font-semibold">المنطقة</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                          <SelectValue placeholder="اختر المنطقة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cairo">القاهرة</SelectItem>
                        <SelectItem value="alexandria">الإسكندرية</SelectItem>
                        <SelectItem value="giza">الجيزة</SelectItem>
                        <SelectItem value="sharkia">الشرقية</SelectItem>
                        <SelectItem value="qalyubia">القليوبية</SelectItem>
                        <SelectItem value="gharbia">الغربية</SelectItem>
                        <SelectItem value="menoufia">المنوفية</SelectItem>
                        <SelectItem value="beheira">البحيرة</SelectItem>
                        <SelectItem value="kafr_el_sheikh">كفر الشيخ</SelectItem>
                        <SelectItem value="damietta">دمياط</SelectItem>
                        <SelectItem value="port_said">بورسعيد</SelectItem>
                        <SelectItem value="ismailia">الإسماعيلية</SelectItem>
                        <SelectItem value="suez">السويس</SelectItem>
                        <SelectItem value="fayoum">الفيوم</SelectItem>
                        <SelectItem value="beni_suef">بني سويف</SelectItem>
                        <SelectItem value="minya">المنيا</SelectItem>
                        <SelectItem value="asyut">أسيوط</SelectItem>
                        <SelectItem value="sohag">سوهاج</SelectItem>
                        <SelectItem value="qena">قنا</SelectItem>
                        <SelectItem value="aswan">أسوان</SelectItem>
                        <SelectItem value="luxor">الأقصر</SelectItem>
                        <SelectItem value="red_sea">البحر الأحمر</SelectItem>
                        <SelectItem value="north_sinai">شمال سيناء</SelectItem>
                        <SelectItem value="south_sinai">جنوب سيناء</SelectItem>
                        <SelectItem value="matrouh">مطروح</SelectItem>
                        <SelectItem value="new_valley">الوادي الجديد</SelectItem>
                        <SelectItem value="dakahlia">الدقهلية</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block font-semibold">نوع المستخدم</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                          <SelectValue placeholder="اختر نوع المستخدم" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={"installer"}>فني (مستخدم عادي)</SelectItem>
                        <SelectItem value={"admin"}>مدير النظام</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2 min-w-32 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الإضافة...
                  </>
                ) : (
                  "إضافة مستخدم جديد"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
