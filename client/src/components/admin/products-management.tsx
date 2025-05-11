import { useState, useEffect } from "react";
import { PlusIcon, PencilIcon, TrashIcon, CheckIcon, XIcon } from "lucide-react";
import { LocalProduct } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ProductsManagementProps {
  products: LocalProduct[];
  onRefresh: () => void;
}

export default function ProductsManagement({ products, onRefresh }: ProductsManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LocalProduct | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    rewardPoints: 10,
    isActive: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const openAddDialog = () => {
    setFormData({
      name: "",
      rewardPoints: 10,
      isActive: true,
    });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (product: LocalProduct) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      rewardPoints: product.rewardPoints,
      isActive: product.isActive === 1,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (product: LocalProduct) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "number") {
      setFormData({
        ...formData,
        [name]: parseInt(value) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData({
      ...formData,
      isActive: checked,
    });
  };

  const handleAddProduct = async () => {
    try {
      if (!formData.name) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم المنتج",
          variant: "destructive",
        });
        return;
      }

      if (formData.rewardPoints <= 0) {
        toast({
          title: "خطأ",
          description: "يجب أن تكون النقاط أكبر من صفر",
          variant: "destructive",
        });
        return;
      }

      const response = await apiRequest("POST", "/api/products", formData);
      
      if (response.ok) {
        toast({
          title: "تم الإضافة",
          description: "تمت إضافة المنتج بنجاح",
        });
        setIsAddDialogOpen(false);
        onRefresh();
      } else {
        const data = await response.json();
        toast({
          title: "خطأ",
          description: data.message || "حدث خطأ أثناء إضافة المنتج",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة المنتج",
        variant: "destructive",
      });
    }
  };

  const handleEditProduct = async () => {
    try {
      if (!selectedProduct) return;
      
      if (!formData.name) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم المنتج",
          variant: "destructive",
        });
        return;
      }

      if (formData.rewardPoints <= 0) {
        toast({
          title: "خطأ",
          description: "يجب أن تكون النقاط أكبر من صفر",
          variant: "destructive",
        });
        return;
      }

      const response = await apiRequest("PATCH", `/api/products/${selectedProduct.id}`, formData);
      
      if (response.ok) {
        toast({
          title: "تم التعديل",
          description: "تم تعديل المنتج بنجاح",
        });
        setIsEditDialogOpen(false);
        onRefresh();
      } else {
        const data = await response.json();
        toast({
          title: "خطأ",
          description: data.message || "حدث خطأ أثناء تعديل المنتج",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error editing product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تعديل المنتج",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async () => {
    try {
      if (!selectedProduct) return;

      const response = await apiRequest("DELETE", `/api/products/${selectedProduct.id}`);
      
      if (response.ok) {
        toast({
          title: "تم الحذف",
          description: "تم حذف المنتج بنجاح",
        });
        setIsDeleteDialogOpen(false);
        onRefresh();
      } else {
        const data = await response.json();
        toast({
          title: "خطأ",
          description: data.message || "حدث خطأ أثناء حذف المنتج",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المنتج",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة المنتجات</h2>
        <Button onClick={openAddDialog}>
          <PlusIcon className="h-4 w-4 ml-2" />
          إضافة منتج
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">رقم المنتج</TableHead>
              <TableHead>اسم المنتج</TableHead>
              <TableHead className="text-center">النقاط</TableHead>
              <TableHead className="text-center">الحالة</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                  لا توجد منتجات. قم بإضافة منتج جديد.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.id}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-center">{product.rewardPoints}</TableCell>
                  <TableCell className="text-center">
                    {product.isActive === 1 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckIcon className="w-3 h-3 ml-1" />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XIcon className="w-3 h-3 ml-1" />
                        غير نشط
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2 rtl:space-x-reverse">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                      >
                        <PencilIcon className="h-4 w-4 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <TrashIcon className="h-4 w-4 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>إضافة منتج جديد</DialogTitle>
            <DialogDescription>
              أدخل تفاصيل المنتج هنا. اضغط على زر الحفظ عند الانتهاء.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                اسم المنتج
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="أدخل اسم المنتج"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rewardPoints" className="text-right">
                النقاط
              </Label>
              <Input
                id="rewardPoints"
                name="rewardPoints"
                type="number"
                value={formData.rewardPoints}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                نشط
              </Label>
              <div className="col-span-3 flex items-center">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={handleSwitchChange}
                  id="isActive"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddProduct}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>تعديل المنتج</DialogTitle>
            <DialogDescription>
              قم بتعديل تفاصيل المنتج هنا. اضغط على زر الحفظ عند الانتهاء.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                اسم المنتج
              </Label>
              <Input
                id="edit-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-rewardPoints" className="text-right">
                النقاط
              </Label>
              <Input
                id="edit-rewardPoints"
                name="rewardPoints"
                type="number"
                value={formData.rewardPoints}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-isActive" className="text-right">
                نشط
              </Label>
              <div className="col-span-3 flex items-center">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={handleSwitchChange}
                  id="edit-isActive"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleEditProduct}>حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedProduct && (
              <p className="text-center font-medium">
                {selectedProduct.name} - {selectedProduct.rewardPoints} نقطة
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}