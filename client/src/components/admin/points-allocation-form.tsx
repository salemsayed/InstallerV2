import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { pointsAllocationSchema, ActivityType } from "@shared/schema";
import { User } from "@shared/schema";

interface PointsAllocationFormProps {
  users: User[];
  onSuccess?: () => void;
}

export default function PointsAllocationForm({ 
  users,
  onSuccess 
}: PointsAllocationFormProps) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<{
    userId: string;
    activityType: string;
    amount: number;
    description: string;
  }>({
    resolver: zodResolver(pointsAllocationSchema),
    defaultValues: {
      userId: "",
      activityType: "",
      amount: 0,
      description: "",
    },
  });

  const onSubmit = async (values: {
    userId: string;
    activityType: string;
    amount: number;
    description: string;
  }) => {
    setIsSubmitting(true);
    
    try {
      // Get admin ID from auth context
      const adminId = authUser?.id;
      
      if (!adminId) {
        throw new Error("لم يتم العثور على بيانات المدير");
      }
      
      const res = await apiRequest("POST", `/api/admin/points?userId=${adminId}`, {
        userId: parseInt(values.userId),
        activityType: values.activityType,
        amount: values.amount,
        description: values.description,
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تمت إضافة النقاط بنجاح",
          description: `تم إضافة ${values.amount} نقطة بنجاح`,
        });
        
        // Reset form
        form.reset({
          userId: "",
          activityType: "",
          amount: 0,
          description: "",
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/admin/users?userId=${adminId}`] });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "فشل إضافة النقاط",
          description: data.message || "حدث خطأ أثناء إضافة النقاط",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل إضافة النقاط",
        description: "حدث خطأ أثناء إضافة النقاط",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border-0 mb-6">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-bold">إضافة نقاط</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اختر الفني</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفني" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="activityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع النشاط</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع النشاط" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ActivityType.INSTALLATION}>تركيب جديد</SelectItem>
                        <SelectItem value={ActivityType.MAINTENANCE}>صيانة</SelectItem>
                        <SelectItem value={ActivityType.TRAINING}>تدريب</SelectItem>
                        <SelectItem value={ActivityType.OTHER}>أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>عدد النقاط</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="أدخل عدد النقاط" 
                        type="number" 
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل وصفًا مختصرًا" {...field} />
                    </FormControl>
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
                    جارٍ الإضافة...
                  </>
                ) : (
                  "إضافة النقاط"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
