import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SAVED_ACCOUNTS_KEY = "primegram:savedAccounts";

export interface SavedAccount {
  userId: string;
  label: string;
  session: Session;
}

const readSavedAccounts = (): SavedAccount[] => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((account): account is SavedAccount =>
      typeof account === "object" &&
      account !== null &&
      "userId" in account &&
      typeof account.userId === "string" &&
      "label" in account &&
      typeof account.label === "string" &&
      "session" in account &&
      typeof account.session === "object" &&
      account.session !== null &&
      "access_token" in account.session &&
      typeof account.session.access_token === "string" &&
      "refresh_token" in account.session &&
      typeof account.session.refresh_token === "string",
    );
  } catch {
    return [];
  }
};

const accountLabel = (session: Session) =>
  session.user.email || session.user.phone || session.user.user_metadata?.nickname || session.user.id;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  savedAccounts: SavedAccount[];
  saveCurrentAccount: () => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  removeSavedAccount: (userId: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  savedAccounts: [],
  saveCurrentAccount: async () => {},
  switchAccount: async () => {},
  removeSavedAccount: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(readSavedAccounts);

  const storeSession = useCallback((current: Session) => {
    const account: SavedAccount = {
      userId: current.user.id,
      label: accountLabel(current),
      session: current,
    };
    const accounts = readSavedAccounts().filter(saved => saved.userId !== account.userId);
    const next = [...accounts, account].slice(-2);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
    setSavedAccounts(next);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session) storeSession(session);
      if (_event === 'SIGNED_OUT') localStorage.removeItem('guestMode');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) storeSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [storeSession]);

  const saveCurrentAccount = async () => {
    const { data: { session: current }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!current) throw new Error("Sign in before adding another account");
    storeSession(current);
  };

  const switchAccount = async (userId: string) => {
    const saved = readSavedAccounts().find(account => account.userId === userId);
    if (!saved) throw new Error("This account is not saved on this device");
    if (session?.user.id === userId) return;
    const { error } = await supabase.auth.setSession({
      access_token: saved.session.access_token,
      refresh_token: saved.session.refresh_token,
    });
    if (error) throw error;
  };

  const removeSavedAccount = (userId: string) => {
    const next = readSavedAccounts().filter(account => account.userId !== userId);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
    setSavedAccounts(next);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, savedAccounts, saveCurrentAccount, switchAccount, removeSavedAccount, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
