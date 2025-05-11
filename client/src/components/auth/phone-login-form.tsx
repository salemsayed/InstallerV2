import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Phone number validation schema for Egyptian mobile numbers
const phoneSchema = z.object({
  phone: z.string()
    .min(11, { message: "رقم الهاتف يجب أن يكون 11 رقم" })
    .max(13, { message: "رقم الهاتف لا يمكن أن يتجاوز 13 رقم" })
    .regex(/^(\+20|0)1[0-2,5]{1}[0-9]{8}$/, { 
      message: "يرجى إدخال رقم هاتف مصري صالح (يبدأ بـ 01)" 
    }),
});

// OTP verification schema
const otpSchema = z.object({
  otp: z.string()
    .length(6, { message: "رمز التحقق يجب أن يتكون من 6 أرقام" })
    .regex(/^\d+$/, { message: "رمز التحقق يجب أن يتكون من أرقام فقط" }),
});

interface PhoneLoginFormProps {
  onSuccess: (userId: number, userRole: string) => void;
}

export default function PhoneLoginForm({ onSuccess }: PhoneLoginFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Phone input form
  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  // OTP input form
  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  });

  // Handle phone form submission
  const onPhoneSubmit = async (data: z.infer<typeof phoneSchema>) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-otp", data);
      const result = await response.json();
      
      if (result.success) {
        setPhoneNumber(data.phone);
        setStep("otp");
        toast({
          title: "تم إرسال رمز التحقق",
          description: "تم إرسال رمز التحقق إلى رقم هاتفك",
          variant: "default",
        });
        
        // For development - auto fill the OTP if returned from the server
        if (result.otp) {
          otpForm.setValue("otp", result.otp);
        }
      } else {
        toast({
          title: "خطأ",
          description: result.message || "حدث خطأ أثناء إرسال رمز التحقق",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP form submission
  const onOTPSubmit = async (data: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", {
        phone: phoneNumber,
        otp: data.otp,
      });
      
      const result = await response.json();
      
      if (result.success && result.user) {
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: `مرحباً ${result.user.name}`,
          variant: "default",
        });
        onSuccess(result.user.id, result.user.role);
      } else {
        toast({
          title: "خطأ",
          description: result.message || "رمز التحقق غير صحيح أو منتهي الصلاحية",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التحقق من رمز التأكيد",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone: phoneNumber });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "تم إعادة إرسال رمز التحقق",
          description: "تم إرسال رمز تحقق جديد إلى رقم هاتفك",
          variant: "default",
        });
        
        // For development - auto fill the OTP if returned from the server
        if (result.otp) {
          otpForm.setValue("otp", result.otp);
        }
      } else {
        toast({
          title: "خطأ",
          description: result.message || "حدث خطأ أثناء إرسال رمز التحقق",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to phone input
  const handleBack = () => {
    setStep("phone");
    otpForm.reset();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      {step === "phone" ? (
        <>
          <CardHeader className="text-right">
            <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
            <CardDescription>
              أدخل رقم هاتفك لتلقي رمز التحقق
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
                <FormField
                  control={phoneForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem dir="rtl">
                      <FormLabel>رقم الهاتف</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            dir="ltr"
                            placeholder="01xxxxxxxxx"
                            className="pl-10 text-left"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      إرسال رمز التحقق
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader className="text-right">
            <CardTitle className="text-2xl font-bold">التحقق من رقم الهاتف</CardTitle>
            <CardDescription>
              أدخل رمز التحقق المرسل إلى {phoneNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-6">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem dir="rtl">
                      <FormLabel>رمز التحقق</FormLabel>
                      <FormControl>
                        <Input
                          dir="ltr"
                          placeholder="000000"
                          className="text-center text-2xl tracking-widest letter-spacing-4"
                          maxLength={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تحقق وتسجيل الدخول"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between flex-row-reverse">
            <Button
              variant="ghost"
              onClick={handleResendOTP}
              disabled={isLoading}
              className="text-sm"
            >
              إعادة إرسال الرمز
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="text-sm"
            >
              تغيير رقم الهاتف
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}