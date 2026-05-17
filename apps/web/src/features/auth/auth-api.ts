import { api } from "@/lib/api";

export interface MeResponse {
  sub: string;
  username: string;
}

export interface LoginResponse {
  username: string;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    username,
    password,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    const { data } = await api.get<MeResponse>("/auth/me");
    return data;
  } catch {
    return null;
  }
}
