import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Btn, Card, ErrorBox, Input } from '../components/ui';

export default function AuthPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      nav('/meetings');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-violet-600">Hintro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Meeting Intelligence</p>
        </div>

        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-violet-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice" required />
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={8} required />
          {error && <ErrorBox message={error} />}
          <Btn type="submit" disabled={loading} className="w-full mt-1">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Btn>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Demo: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">demo@hintro.test</code> / <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Password123</code>
        </p>
      </Card>
    </div>
  );
}
