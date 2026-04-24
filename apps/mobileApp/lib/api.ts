import { getToken } from "./tokenStorage";

const BASE_URL = "https://api.aurora-walls.com"

export type User = {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl?: string | null
  coverUrl?: string | null
  bio?: string | null
  isCreator?: boolean
  isPro?: boolean
  totalDownloads?: number
  totalUploads?: number
  createdAt?: string
}

export async function request<T>(
  path:string , 
  options:RequestInit = {}
):Promise<T>{
  const token = await getToken(); 
  const headers:Record<string,string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if(token){
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(BASE_URL+path, {
    ...options,
    headers,
  });
  if(!response.ok){ 
    const error = await response.json();
    throw new Error(error.error || "Request failed");
  } 
  return response.json();
}