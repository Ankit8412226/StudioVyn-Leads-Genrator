'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { ArrowRight, Lock, Mail, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.email) {
      setErrors({ email: 'Email is required' });
      return;
    }
    if (!formData.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login(formData.email, formData.password);
      const { user, tenant, accessToken, refreshToken } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setAuth(user, tenant);

      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed. Please try again.';
      toast.error(message);
      setErrors({ form: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-400/10 blur-3xl" />
      </div>

      <Card variant="glass" className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25">
              <Users className="h-6 w-6 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your Studiovyn account</CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                icon={<Mail className="h-4 w-4" />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={errors.email}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={errors.password}
              />
            </div>

            {errors.form && (
              <p className="text-sm text-red-600 text-center">{errors.form}</p>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                Sign up free
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
