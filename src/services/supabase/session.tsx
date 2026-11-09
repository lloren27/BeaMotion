import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './client';
import { getTrainingSupabase, isTrainingSupabaseConfigured } from '../training-supabase/client';

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  trainingStatus: 'unconfigured' | 'pending' | 'ready' | 'error';
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainingStatus, setTrainingStatus] = useState<SessionContextValue['trainingStatus']>(
    isTrainingSupabaseConfigured() ? 'pending' : 'unconfigured',
  );

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session && isTrainingSupabaseConfigured()) {
        const { data: training } = await getTrainingSupabase().auth.getSession();
        setTrainingStatus(training.session ? 'ready' : 'error');
      }
    }).catch(() => {
      setTrainingStatus('error');
    }).finally(() => setLoading(false));
    return () => subscription.subscription.unsubscribe();
  }, []);

  const value: SessionContextValue = {
    session,
    loading,
    trainingStatus,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (isTrainingSupabaseConfigured()) {
        setTrainingStatus('pending');
        try {
          const { error: trainingError } = await getTrainingSupabase().auth.signInWithPassword({ email, password });
          if (trainingError) throw trainingError;
          setTrainingStatus('ready');
        } catch {
          setTrainingStatus('error');
        }
      }
    },
    signOut: async () => {
      const signOuts = [supabase.auth.signOut()];
      if (isTrainingSupabaseConfigured()) signOuts.push(getTrainingSupabase().auth.signOut());
      const results = await Promise.all(signOuts);
      setTrainingStatus(isTrainingSupabaseConfigured() ? 'pending' : 'unconfigured');
      const error = results[0].error;
      const trainingError = results[1]?.error;
      if (error) throw error;
      if (trainingError) throw trainingError;
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession requiere SessionProvider');
  return value;
}
