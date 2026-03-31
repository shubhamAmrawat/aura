import { cookies } from "next/headers";

export async function meServer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aura_token")?.value;

  if (!token) return null;

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: `aura_token=${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.user;
}
