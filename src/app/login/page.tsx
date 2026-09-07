import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm title="Đăng nhập Rootlingo" endpoint="/api/auth/login" defaultRedirect="/" />
    </Suspense>
  );
}
