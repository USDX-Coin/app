"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { mockLogin, mockRegister } from "@/lib/api/mock-api";
import type { LoginRequest, RegisterRequest } from "@/lib/api/types";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (req: LoginRequest) => mockLogin(req),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push("/mint");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (req: RegisterRequest) => mockRegister(req),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push("/mint");
    },
  });

  function logout() {
    storeLogout();
    router.push("/login");
  }

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    loginLoading: loginMutation.isPending,
    registerLoading: registerMutation.isPending,
    loginError: loginMutation.error?.message ?? null,
    registerError: registerMutation.error?.message ?? null,
  };
}
