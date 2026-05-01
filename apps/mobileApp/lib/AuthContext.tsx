import { createContext, useContext, useEffect, useState } from "react";
import { ReactNode } from "react";
import { User } from "./api";
import { deleteToken, getToken, saveToken } from "./tokenStorage";
import { getMe } from "./authApi";
type AuthContextType = {
  user: User | null;
  loaded: boolean
  onLogin: (token: string, user: User) => Promise<void>
  onLogout: () => Promise<void>
  setUser: (nextUser: User | null | ((prev: User | null) => User | null)) => void
};
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
          setUser(user);
        }
      } catch{
        await deleteToken(); 
      }finally{
        setLoaded(true);
      }
    }
    restoreSession();
  },[])
  const onLogin = async (token: string, user: User) => {
    await saveToken(token);
    setUser(user);
  };
  
  const onLogout = async () => {
    await deleteToken();
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