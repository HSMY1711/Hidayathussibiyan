import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/auth/login', { username, password });
      navigate('/admin');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 pb-2 text-center">
          <div className="section-label">Hidayathussibiyan Madarasa</div>
          <CardTitle className="font-display text-xl">Jashne Rabeeh — Admin Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">Username</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Authorised staff only. All management actions are logged against your account.
          </p>
        </CardContent>
      </Card>
      <Toaster position="top-center" richColors />
    </div>
  );
}
