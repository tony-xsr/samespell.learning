import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm title="Đăng nhập Admin" endpoint="/api/auth/admin-login" defaultRedirect="/admin" />
    </Suspense>
  );
}
