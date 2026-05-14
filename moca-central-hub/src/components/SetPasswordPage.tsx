import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

interface SetPasswordPageProps {
    onComplete: () => void;
}

export function SetPasswordPage({ onComplete }: SetPasswordPageProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const validatePassword = () => {
        if (password.length < 8) {
            return 'La password deve essere di almeno 8 caratteri';
        }
        if (password !== confirmPassword) {
            return 'Le password non corrispondono';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validationError = validatePassword();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            // Clear the must_change_password flag
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                await supabase
                    .from('users')
                    .update({ must_change_password: false })
                    .eq('id', currentUser.id);
            }

            setSuccess(true);

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                onComplete();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'impostazione della password');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-moca-black mb-2">Password Impostata!</h1>
                    <p className="text-moca-gray">
                        La tua password è stata configurata con successo. Verrai reindirizzato alla dashboard...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-moca-red-light rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} className="text-moca-red" />
                    </div>
                    <h1 className="text-2xl font-bold text-moca-black">Configura la tua Password</h1>
                    <p className="text-moca-gray mt-2">
                        Benvenuto in Moca Hub! Imposta una password sicura per il tuo account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-moca-black mb-2">
                            Nuova Password *
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 pr-10 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                                placeholder="Minimo 8 caratteri"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-moca-gray hover:text-moca-black"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-moca-black mb-2">
                            Conferma Password *
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-moca-gray rounded-md focus:outline-none focus:ring-2 focus:ring-moca-red focus:border-moca-red"
                            placeholder="Ripeti la password"
                            required
                        />
                    </div>

                    {/* Password requirements */}
                    <div className="bg-gray-50 p-3 rounded-md text-sm">
                        <p className="font-medium text-moca-black mb-2">La password deve contenere:</p>
                        <ul className="space-y-1 text-moca-gray">
                            <li className={password.length >= 8 ? 'text-green-600' : ''}>
                                ✓ Almeno 8 caratteri
                            </li>
                            <li className={password === confirmPassword && password.length > 0 ? 'text-green-600' : ''}>
                                ✓ Corrispondenza tra le due password
                            </li>
                        </ul>
                    </div>

                    {error && (
                        <div className="flex items-center p-3 bg-red-100 text-red-800 rounded-md">
                            <AlertCircle size={18} className="mr-2 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || password.length < 8 || password !== confirmPassword}
                        className="w-full bg-moca-red text-white py-3 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                        {loading ? 'Configurando...' : 'Imposta Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
