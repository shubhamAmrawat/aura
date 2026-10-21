import { createContext, useContext, useEffect, useState } from "react";
import { ReactNode } from "react";
import { ApiError, User } from "./api";
import { deleteToken, getToken, saveToken } from "./tokenStorage";
import { getMe } from "./authApi";
import { signOutOfGoogle } from "./googleAuth";
import { Sentry } from "./sentry";
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
      } catch (e) {
        // Only a rejected token signs you out. Offline or a busy server (e.g. a 504) keeps it,
        // so the next launch signs you back in.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) await deleteToken();
      }finally{
        setLoaded(true);
      }
    }
    restoreSession();
  },[])
  // Login responses only carry basic fields (no cover, bio, etc.), so the full profile
  // is loaded from /me in the background — the app moves on right away with the basic user.
  const onLogin = async (token: string, user: User) => {
    if (user.role === "admin") {
      throw new Error(ADMIN_ONLY_WEB);
    }
    await saveToken(token);
    setUser(user);
    getMe()
      .then(({ user: full }) => setUser(full))
      .catch(() => {
        // keep the basic user; the next app start will load the full profile
      });
  };
  
  // Crash reports say which account hit them (id only, no email or name).
  useEffect(() => {
    Sentry.setUser(user ? { id: user.id } : null);
  }, [user?.id]);

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