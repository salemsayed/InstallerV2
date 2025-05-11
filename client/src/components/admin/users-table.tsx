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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">نشط</Badge>;
      case UserStatus.PENDING:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">معلق</Badge>;
      case UserStatus.INACTIVE:
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">غير نشط</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border-0 mb-6">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold">أحدث الفنيين</CardTitle>
          {onViewAll && (
            <Button variant="link" onClick={onViewAll} className="text-primary p-0">
              عرض الكل
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <div className="text-center p-4 text-neutral-500">
              <p>لا يوجد فنيين حتى الآن</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">المنطقة</TableHead>
                  <TableHead className="text-right">النقاط</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} className="border-b border-neutral-200">
                    <TableCell className="py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center ml-2">
                          <span className="material-icons text-sm text-neutral-500">person</span>
                        </div>
                        <span>{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {user.region === "riyadh" && "الرياض"}
                      {user.region === "jeddah" && "جدة"}
                      {user.region === "dammam" && "الدمام"}
                      {user.region === "other" && "أخرى"}
                      {!user.region && "-"}
                    </TableCell>
                    <TableCell className="py-3 font-medium">{formatNumber(user.points)}</TableCell>
                    <TableCell className="py-3">
                      {getStatusBadge(user.status)}
                    </TableCell>
                    <TableCell className="py-3">
                      {onUserAction && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="p-1">
                              <span className="material-icons text-primary">more_vert</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onUserAction("view", user.id)}>
                              <span className="material-icons ml-2 text-sm">visibility</span>
                              <span>عرض التفاصيل</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUserAction("edit", user.id)}>
                              <span className="material-icons ml-2 text-sm">edit</span>
                              <span>تعديل</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUserAction("points", user.id)}>
                              <span className="material-icons ml-2 text-sm">add_circle</span>
                              <span>إضافة نقاط</span>
                            </DropdownMenuItem>
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
      </CardContent>
    </Card>
  );
}
