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
import { useAuth } from "@/hooks/auth-provider";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email({
    message: "يرجى إدخال بريد إلكتروني صحيح",
  }),
});

interface LoginFormProps {
  onSuccess: (token: string, email: string) => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setError(null);
    const result = await login(values.email);
    
    if (result.success && result.token && result.email) {
      onSuccess(result.token, result.email);
    } else {
      setError("فشل إرسال رابط تسجيل الدخول. يرجى المحاولة مرة أخرى.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>البريد الإلكتروني</FormLabel>
              <FormControl>
                <Input 
                  placeholder="أدخل بريدك الإلكتروني" 
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
        
        {error && (
          <div className="text-destructive text-sm">{error}</div>
        )}
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? "جارٍ الإرسال..." : "إرسال رابط تسجيل الدخول"}
        </Button>
      </form>
    </Form>
  );
}
