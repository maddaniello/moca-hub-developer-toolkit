import { createContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../lib/types';

interface AuthContextType {
  user: SupabaseUser | null;
  userData: User | null;
  loading: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  mustChangePassword: false,
  clearMustChangePassword: () => { },
  signIn: async () => { },
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setUserData(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, client:clients(*)')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user data:', error);
        // Don't throw, just log. We might still want to allow basic auth state even if DB fetch fails
        // but for now let's assume if DB fetch fails, we can't fully hydrate user.
      }

      setUserData(data);

      if (data?.must_change_password) {
        setMustChangePassword(true);
      }

      if (data) {
        // Update last_login using secure RPC to bypass RLS restrictive policies
        // We await this now to ensure the Dashboard sees the updated timestamp
        const { error: rpcError } = await supabase.rpc('update_last_login');

        if (rpcError) {
          console.warn('Failed to update last_login via RPC', rpcError);
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, mustChangePassword, clearMustChangePassword, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
