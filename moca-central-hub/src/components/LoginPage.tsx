import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Errore durante l\'invio dell\'email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moca-red-light to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 border border-moca-red-light">
          <div className="flex justify-center mb-8">
            <img
              src="https://mocainteractive.com/assets/svg/logo.svg"
              alt="Moca Logo"
              className="h-16"
            />
          </div>

          {showForgotPassword ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetError('');
                  setResetEmail('');
                }}
                className="flex items-center text-sm text-moca-gray hover:text-moca-black transition-colors mb-4"
              >
                <ArrowLeft size={16} className="mr-1" />
                Torna al login
              </button>

              <h1 className="text-2xl font-bold text-moca-black mb-2">
                Password dimenticata?
              </h1>
              <p className="text-moca-gray mb-6 text-sm">
                Inserisci il tuo indirizzo email e ti invieremo un link per reimpostare la password.
              </p>

              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-moca-black mb-2">Email inviata!</h2>
                  <p className="text-sm text-moca-gray">
                    Controlla la tua casella di posta a <strong>{resetEmail}</strong>. Segui il link nell'email per reimpostare la password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSent(false);
                      setResetEmail('');
                    }}
                    className="mt-6 text-sm text-moca-red hover:underline font-semibold"
                  >
                    Torna al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-semibold text-moca-black mb-2">
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  {resetError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                      {resetError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-moca-red text-white py-2 px-4 rounded-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Invio in corso...' : 'Invia link di reset'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-center text-moca-black mb-2">
                Hub
              </h1>
              <p className="text-center text-moca-gray mb-8">
                Sistema di gestione utenti e clienti
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-moca-black mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-moca-black mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-moca-red text-white py-2 px-4 rounded-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Accesso in corso...' : 'Accedi'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setResetEmail(email);
                    }}
                    className="text-sm text-moca-gray hover:text-moca-red transition-colors"
                  >
                    Password dimenticata?
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
