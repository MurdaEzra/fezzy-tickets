import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {}, deleteAccount: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe FIRST to avoid missed events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) throw error;
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, session, loading, signOut, deleteAccount }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
