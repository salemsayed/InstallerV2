import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Edit2, Trash2, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Icons for badges from Material Icons
const AVAILABLE_ICONS = [
  // Achievements
  "emoji_events", // Trophy
  "workspace_premium", // Premium badge
  "military_tech", // Medal
  "stars", // Stars
  "diamond", // Diamond
  "auto_awesome", // Sparkles
  "local_fire_department", // Fire
  "bolt", // Lightning bolt
  "grade", // Star
  "recommend", // Thumbs up in a circle
  
  // Work-related
  "badge", // Badge
  "verified", // Verified
  "thumb_up", // Thumbs up
  "rocket_launch", // Rocket
  "psychology", // Brain/skill
  "engineering", // Tools
  "build", // Wrench
  "construction", // Construction
  "handyman", // Handyman
  "home_repair_service", // Home repair
  "hardware", // Hardware
  "architecture", // Architecture
  "work", // Work briefcase
  
  // Conceptual
  "timer", // Speed
  "verified_user", // Shield with check
  "settings", // Gear
  "account_circle", // User
  "person", // Person
  "groups", // Teams
  "lightbulb", // Idea
  "trending_up", // Trending up
  "insights", // Insights
  "speed", // Speedometer
  
  // Products
  "light", // Light
  "light_mode", // Sun
  "wb_sunny", // Sunny
  "highlight", // Highlight
  "electric_bolt", // Electric bolt
  "tungsten", // Tungsten light
  "category", // Category
  "inventory_2", // Inventory
  
  // Experience
  "school", // Graduation
  "auto_stories", // Book
  "history_edu", // Scroll/education
  "analytics", // Analytics
  "leaderboard", // Leaderboard
];

// Form schema for badge creation and editing
const badgeFormSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يكون الاسم حرفين على الأقل" }),
  description: z.string().min(5, { message: "يجب أن يكون الوصف 5 أحرف على الأقل" }),
  icon: z.string().min(1, { message: "يرجى اختيار أيقونة" }),
  requiredPoints: z.coerce.number().min(0, { message: "يجب أن تكون النقاط رقم صحيح موجب" }),
  minInstallations: z.coerce.number().min(0, { message: "يجب أن يكون عدد التركيبات رقم صحيح موجب" }),
  active: z.boolean().default(true),
});

type BadgeFormValues = z.infer<typeof badgeFormSchema>;

interface BadgesManagementProps {
  badges: Badge[];
  onRefresh: () => void;
}

export default function BadgesManagement({ badges, onRefresh }: BadgesManagementProps) {
  const { toast } = useToast();
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form setup
  const form = useForm<BadgeFormValues>({
    resolver: zodResolver(badgeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "emoji_events",
      requiredPoints: 0,
      minInstallations: 0,
      active: true,
    },
  });

  // Create new badge
  const createBadgeMutation = useMutation({
    mutationFn: async (formValues: BadgeFormValues) => {
      // Ensure numeric fields are valid numbers or 0
      const values = {
        ...formValues,
        requiredPoints: typeof formValues.requiredPoints === 'number' && !isNaN(formValues.requiredPoints) 
          ? formValues.requiredPoints : 0,
        minInstallations: typeof formValues.minInstallations === 'number' && !isNaN(formValues.minInstallations)
          ? formValues.minInstallations : 0
      };
      
      const res = await apiRequest("POST", "/api/admin/badges", values);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الشارة بنجاح",
        description: "تمت إضافة الشارة الجديدة إلى النظام",
      });
      setIsDialogOpen(false);
      form.reset();
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "حدث خطأ",
        description: error.message || "فشل في إنشاء الشارة",
        variant: "destructive",
      });
    },
  });

  // Update existing badge
  const updateBadgeMutation = useMutation({
    mutationFn: async (values: BadgeFormValues & { id: number }) => {
      const { id, ...formData } = values;
      
      // Ensure numeric fields are valid numbers or 0
      const data = {
        ...formData,
        requiredPoints: typeof formData.requiredPoints === 'number' && !isNaN(formData.requiredPoints) 
          ? formData.requiredPoints : 0,
        minInstallations: typeof formData.minInstallations === 'number' && !isNaN(formData.minInstallations)
          ? formData.minInstallations : 0
      };
      
      const res = await apiRequest("PATCH", `/api/admin/badges/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث الشارة بنجاح",
        description: "تم تحديث بيانات الشارة في النظام",
      });
      setIsDialogOpen(false);
      setEditingBadge(null);
      form.reset();
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "حدث خطأ",
        description: error.message || "فشل في تحديث الشارة",
        variant: "destructive",
      });
    },
  });

  // Delete badge
  const deleteBadgeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/badges/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم حذف الشارة بنجاح",
        description: "تم حذف الشارة من النظام",
      });
      onRefresh();
    },
    onError: (error: any) => {
      toast({
        title: "حدث خطأ",
        description: error.message || "فشل في حذف الشارة",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: BadgeFormValues) => {
    if (editingBadge) {
      updateBadgeMutation.mutate({ ...values, id: editingBadge.id });
    } else {
      createBadgeMutation.mutate(values);
    }
  };

  // Open dialog for editing
  const handleEditBadge = (badge: Badge) => {
    setEditingBadge(badge);
    form.reset({
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon,
      requiredPoints: badge.requiredPoints || 0,
      minInstallations: badge.minInstallations || 0,
      active: !!badge.active,
    });
    setIsDialogOpen(true);
  };

  // Open dialog for creating
  const handleAddBadge = () => {
    setEditingBadge(null);
    form.reset({
      name: "",
      description: "",
      icon: "emoji_events",
      requiredPoints: 0,
      minInstallations: 0,
      active: true,
    });
    setIsDialogOpen(true);
  };

  // Handle deleting badge
  const handleDeleteBadge = (id: number) => {
    if (window.confirm("هل أنت متأكد من حذف هذه الشارة؟")) {
      deleteBadgeMutation.mutate(id);
    }
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">إدارة الشارات</CardTitle>
        <CardDescription>
          قم بإدارة الشارات التي يمكن للمستخدمين الحصول عليها عند تحقيق أهداف معينة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">قائمة الشارات</h3>
          <Button onClick={handleAddBadge} variant="outline" className="flex items-center gap-1">
            <Plus className="h-4 w-4" />
            إضافة شارة
          </Button>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>متطلبات الحصول</TableHead>
                <TableHead className="text-right w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {badges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                    لا توجد شارات بعد. قم بإضافة شارات جديدة.
                  </TableCell>
                </TableRow>
              ) : (
                badges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell>
                      <span className="material-icons text-xl">{badge.icon}</span>
                    </TableCell>
                    <TableCell className="font-medium">{badge.name}</TableCell>
                    <TableCell>{badge.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        {badge.requiredPoints ? <span>النقاط: {badge.requiredPoints}</span> : null}
                        {badge.minInstallations ? <span>التركيبات: {badge.minInstallations}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditBadge(badge)}
                          title="تعديل"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBadge(badge.id)}
                          title="حذف"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Badge Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingBadge ? "تعديل شارة" : "إضافة شارة جديدة"}</DialogTitle>
            <DialogDescription>
              أدخل معلومات الشارة والمتطلبات اللازمة للحصول عليها.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الشارة</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="مثال: فني متميز" />
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
                    <FormLabel>وصف الشارة</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="وصف الشارة والمتطلبات للحصول عليها" 
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>أيقونة الشارة</FormLabel>
                    <div className="grid grid-cols-8 gap-2 p-2 border rounded-md">
                      {AVAILABLE_ICONS.map((icon) => (
                        <div
                          key={icon}
                          className={`cursor-pointer p-2 rounded-md flex items-center justify-center ${
                            field.value === icon ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                          onClick={() => form.setValue("icon", icon)}
                        >
                          <span className="material-icons">{icon}</span>
                        </div>
                      ))}
                    </div>
                    <FormDescription>
                      انقر على الأيقونة المطلوبة للاختيار
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="requiredPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>النقاط المطلوبة</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>
                        عدد النقاط المطلوبة للحصول على الشارة
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="minInstallations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عدد التركيبات المطلوبة</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>
                        عدد التركيبات المطلوبة للحصول على الشارة
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit"
                  disabled={createBadgeMutation.isPending || updateBadgeMutation.isPending}
                >
                  {(createBadgeMutation.isPending || updateBadgeMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingBadge ? "تحديث الشارة" : "إضافة شارة"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}