import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { User, UserStatus } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UsersTableProps {
  users: User[];
  onViewAll?: () => void;
  onUserAction?: (action: string, userId: number) => void;
}

export default function UsersTable({ users, onViewAll, onUserAction }: UsersTableProps) {
  console.log("UsersTable rendered with users:", users);
  const getStatusBadge = (status: string) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">نشط</Badge>;
      case UserStatus.PENDING:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">معلق</Badge>;
      case UserStatus.INACTIVE:
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">غير نشط</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    return role === "admin" 
      ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">مدير</Badge>
      : <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">فني</Badge>;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">إجمالي المستخدمين: {users.length}</span>
        </div>
        {onViewAll && (
          <Button variant="outline" onClick={onViewAll} size="sm" className="text-primary border-primary hover:bg-primary/5">
            عرض الكل
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-white">
            <span className="material-icons text-3xl mb-2">person_off</span>
            <p>لا يوجد مستخدمين حتى الآن</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow>
                <TableHead className="text-right font-bold">الاسم</TableHead>
                <TableHead className="text-right font-bold">رقم الهاتف</TableHead>
                <TableHead className="text-right font-bold">المنطقة</TableHead>
                <TableHead className="text-right font-bold">النقاط</TableHead>
                <TableHead className="text-right font-bold">نوع المستخدم</TableHead>
                <TableHead className="text-right font-bold">الحالة</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <TableCell className="py-3 font-medium">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center ml-2 text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 font-mono text-sm" dir="ltr">
                    {user.phone || "-"}
                  </TableCell>
                  <TableCell className="py-3">
                    {user.region === "riyadh" && "الرياض"}
                    {user.region === "jeddah" && "جدة"}
                    {user.region === "dammam" && "الدمام"}
                    {user.region === "cairo" && "القاهرة"}
                    {user.region === "alexandria" && "الإسكندرية"}
                    {user.region === "other" && "أخرى"}
                    {!user.region && "-"}
                  </TableCell>
                  <TableCell className="py-3 font-medium">{formatNumber(user.points)}</TableCell>
                  <TableCell className="py-3">
                    {getRoleBadge(user.role)}
                  </TableCell>
                  <TableCell className="py-3">
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell className="py-3">
                    {onUserAction && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="p-1 rounded-full h-8 w-8 hover:bg-gray-100">
                            <span className="material-icons text-gray-600">more_vert</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onUserAction("edit", user.id)} className="cursor-pointer">
                            <span className="material-icons ml-2 text-sm">edit</span>
                            <span>تعديل البيانات</span>
                          </DropdownMenuItem>
                          {user.role === "installer" && (
                            <DropdownMenuItem onClick={() => onUserAction("points", user.id)} className="cursor-pointer">
                              <span className="material-icons ml-2 text-sm">add_circle</span>
                              <span>إضافة نقاط</span>
                            </DropdownMenuItem>
                          )}
                          {user.role !== "admin" && (
                            <DropdownMenuItem 
                              onClick={() => onUserAction("delete", user.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <span className="material-icons ml-2 text-sm">delete</span>
                              <span>حذف المستخدم</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
