import { createContext, useContext, useEffect, useState } from "react";
import { ReactNode } from "react";
import { User } from "./api";
import { deleteToken, getToken, saveToken } from "./tokenStorage";
import { getMe } from "./authApi";
import { signOutOfGoogle } from "./googleAuth";
type AuthContextType = {
  user: User | null;
  loaded: boolean
  onLogin: (token: string, user: User) => Promise<void>
  onLogout: () => Promise<void>
  setUser: (nextUser: User | null | ((prev: User | null) => User | null)) => void
};
const ADMIN_ONLY_WEB = "Admin accounts can only sign in on the web dashboard.";

export const AuthContext = createContext<AuthContextType | null>(null); 


export function AuthProvider({children}:{children:ReactNode}){
  const [user , setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(()=>{
    async function restoreSession(){
      try {
        const token = await getToken(); 
        if(token){
          const {user}= await getMe(); 
          if (user.role === "admin") {
            // Admin accounts only use the web dashboard
            await deleteToken();
          } else {
            setUser(user);
          }
        }
      } catch{
        await deleteToken(); 
      }finally{
        setLoaded(true);
      }
    }
    restoreSession();
  },[])
  // Login responses only carry basic fields (no cover, bio, etc.), so load the
  // full profile from /me right away; fall back to the basic user if that fails.
  const onLogin = async (token: string, user: User) => {
    if (user.role === "admin") {
      throw new Error(ADMIN_ONLY_WEB);
    }
    await saveToken(token);
    setUser(user);
    try {
      const { user: full } = await getMe();
      setUser(full);
    } catch {
      // keep the basic user; the next app start will load the full profile
    }
  };
  
  const onLogout = async () => {
    await deleteToken();
    void signOutOfGoogle(); // so the next Google sign-in shows the account picker again
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{user, loaded, onLogin, onLogout, setUser}}>
      {children}
    </AuthContext.Provider>
  ); 
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}