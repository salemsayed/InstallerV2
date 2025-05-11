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
      // Ensure phone is in international format
      let phone = data.phone;
      if (phone.startsWith('0')) {
        phone = '+2' + phone;
      }
      
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone });
      const result = await response.json();
      
      if (result.success) {
        // Store the formatted phone number
        setPhoneNumber(phone);
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
    } catch (error: any) {
      // Special handling for 401 (Unauthorized) or 403 (Forbidden) errors
      if (error.status === 401 || error.status === 403) {
        toast({
          title: "غير مصرح",
          description: error.message || "رقم الهاتف غير مسجل. يرجى التواصل مع المسؤول لإضافة حسابك.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message || "حدث خطأ أثناء الاتصال بالخادم",
          variant: "destructive",
        });
      }
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
    } catch (error: any) {
      // Special handling for different error status codes
      if (error.status === 400) {
        toast({
          title: "رمز غير صالح",
          description: error.message || "رمز التحقق غير صحيح أو منتهي الصلاحية",
          variant: "destructive",
        });
      } else if (error.status === 401 || error.status === 403) {
        toast({
          title: "غير مصرح",
          description: error.message || "لا يمكن التحقق من حسابك. يرجى التواصل مع المسؤول.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message || "حدث خطأ أثناء التحقق من رمز التأكيد",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      // Ensure phone has proper format (should already be formatted, but double-check)
      let phone = phoneNumber;
      if (phone.startsWith('0')) {
        phone = '+2' + phone;
      }
      
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone });
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
    <div className="w-full">
      {step === "phone" ? (
        <>
          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-6">
              <FormField
                control={phoneForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem dir="rtl">
                    <FormLabel className="text-gray-700">رقم الهاتف</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-3 h-5 w-5 text-primary/60" />
                        <Input
                          dir="ltr"
                          placeholder="01xxxxxxxxx"
                          className="pl-10 text-left bg-gray-50 border-gray-200 h-12 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 text-md font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    إرسال رمز التحقق
                  </>
                )}
              </Button>
            </form>
          </Form>
        </>
      ) : (
        <>
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              تم إرسال رمز التأكيد
            </h3>
            <p className="text-gray-500 text-sm">
              برجاء إدخال الرمز المرسل إلى {phoneNumber}
            </p>
          </div>
          
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-6">
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem dir="rtl">
                    <FormLabel className="text-gray-700">رمز التحقق</FormLabel>
                    <FormControl>
                      <Input
                        dir="ltr"
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest letter-spacing-4 bg-gray-50 border-gray-200 h-14 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        maxLength={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 text-md font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  "تحقق وتسجيل الدخول"
                )}
              </Button>
              
              <div className="flex justify-between flex-row-reverse pt-4">
                <Button
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="text-sm hover:text-primary hover:bg-primary/5"
                >
                  إعادة إرسال الرمز
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                >
                  تغيير رقم الهاتف
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}