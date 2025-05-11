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
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { insertUserSchema, UserRole, UserStatus } from "@shared/schema";

// Extend the schema to make the form fields required
const formSchema = insertUserSchema.extend({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  region: z.string().min(1, { message: "يرجى اختيار المنطقة" }),
});

interface InviteFormProps {
  adminId: number;
  onSuccess?: () => void;
}

export default function InviteForm({ adminId, onSuccess }: InviteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      region: "",
      role: UserRole.INSTALLER,
      status: UserStatus.PENDING,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      const res = await apiRequest("POST", `/api/admin/users?userId=${adminId}`, values);
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تمت إضافة الفني بنجاح",
          description: "تم إرسال دعوة للفني بنجاح",
        });
        
        // Reset form
        form.reset({
          name: "",
          email: "",
          phone: "",
          region: "",
          role: UserRole.INSTALLER,
          status: UserStatus.PENDING,
        });
        
        // Invalidate users query to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/admin/users?userId=${adminId}`] });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "فشل إضافة الفني",
          description: data.message || "حدث خطأ أثناء إضافة الفني",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل إضافة الفني",
        description: "حدث خطأ أثناء إضافة الفني",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border-0 mb-6">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-bold">إضافة فني جديد</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل اسم الفني" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="أدخل البريد الإلكتروني" 
                        type="email" 
                        {...field} 
                        dir="ltr"
                        className="text-right"
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
                    <FormLabel>رقم الهاتف</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="أدخل رقم الهاتف" 
                        type="tel" 
                        {...field} 
                        dir="ltr"
                        className="text-right"
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
                    <FormLabel>المنطقة</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المنطقة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="riyadh">الرياض</SelectItem>
                        <SelectItem value="jeddah">جدة</SelectItem>
                        <SelectItem value="dammam">الدمام</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الإرسال...
                  </>
                ) : (
                  "إرسال دعوة"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
