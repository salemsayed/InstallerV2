import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
  "emoji_events", // Trophy
  "workspace_premium", // Premium badge
  "military_tech", // Medal
  "stars", // Stars
  "badge", // Badge
  "verified", // Verified
  "thumb_up", // Thumbs up
  "rocket_launch", // Rocket
  "diamond", // Diamond
  "psychology", // Brain/skill
  "engineering", // Tools
  "build", // Wrench
  "architecture", // Architecture
  "timer", // Speed
  "verified_user", // Shield with check
  "settings", // Gear
];

// Form schema for badge creation and editing
const badgeFormSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يكون الاسم حرفين على الأقل" }),
  description: z.string().min(5, { message: "يجب أن يكون الوصف 5 أحرف على الأقل" }),
  icon: z.string().min(1, { message: "يرجى اختيار أيقونة" }),
  requiredPoints: z.coerce.number().min(0, { message: "يجب أن تكون النقاط رقم صحيح موجب" }).optional(),
  minLevel: z.coerce.number().min(1, { message: "يجب أن يكون المستوى رقم صحيح موجب" }).optional(),
  minInstallations: z.coerce.number().min(0, { message: "يجب أن يكون عدد التركيبات رقم صحيح موجب" }).optional(),
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
  const [selectedTab, setSelectedTab] = useState<"badges" | "levels">("badges");

  // Form setup
  const form = useForm<BadgeFormValues>({
    resolver: zodResolver(badgeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "emoji_events",
      requiredPoints: 0,
      minLevel: 1,
      minInstallations: 0,
    },
  });

  // Create new badge
  const createBadgeMutation = useMutation({
    mutationFn: async (values: BadgeFormValues) => {
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
      const { id, ...data } = values;
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
      minLevel: badge.minLevel || 1,
      minInstallations: badge.minInstallations || 0,
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
      minLevel: 1,
      minInstallations: 0,
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
        <CardTitle className="text-xl">إدارة الشارات والمستويات</CardTitle>
        <CardDescription>
          قم بإدارة الشارات والمستويات التي يمكن للمستخدمين الحصول عليها عند تحقيق أهداف معينة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "badges" | "levels")}>
          <TabsList className="mb-4">
            <TabsTrigger value="badges">الشارات</TabsTrigger>
            <TabsTrigger value="levels">المستويات</TabsTrigger>
          </TabsList>
          
          <TabsContent value="badges">
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
                            {badge.minLevel ? <span>المستوى: {badge.minLevel}</span> : null}
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
          </TabsContent>
          
          <TabsContent value="levels">
            <div className="space-y-4">
              <div className="text-center p-8 border rounded-lg bg-muted/20">
                <h3 className="text-lg font-medium mb-2">نظام المستويات</h3>
                <p className="text-muted-foreground mb-4">
                  يعتمد نظام المستويات على عدد النقاط التي يحصل عليها المستخدم. كلما زادت النقاط، ارتفع المستوى.
                </p>
                
                <div className="max-w-md mx-auto grid grid-cols-2 gap-4 text-right">
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 1</span>
                    <p className="text-sm text-muted-foreground">0 نقطة</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 2</span>
                    <p className="text-sm text-muted-foreground">100 نقطة</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 3</span>
                    <p className="text-sm text-muted-foreground">300 نقطة</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 4</span>
                    <p className="text-sm text-muted-foreground">600 نقطة</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 5</span>
                    <p className="text-sm text-muted-foreground">1000 نقطة</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-lg font-bold">المستوى 6</span>
                    <p className="text-sm text-muted-foreground">1500 نقطة</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="requiredPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>النقاط المطلوبة</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="minLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المستوى الأدنى</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="minInstallations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عدد التركيبات</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
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
                  {createBadgeMutation.isPending || updateBadgeMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    "حفظ"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}