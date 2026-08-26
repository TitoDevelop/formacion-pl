import { Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { Profile } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<User | null>(null);
  profile = signal<Profile | null>(null);
  initialized = signal(false);

  constructor(private db: SupabaseService) {
    this.db.client.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
      void this.loadProfile();
    });
  }

  async init(): Promise<void> {
    const { data } = await this.db.client.auth.getSession();
    this.user.set(data.session?.user ?? null);
    await this.loadProfile();
    this.initialized.set(true);
  }

  async login(email: string, password: string) {
    const result = await this.db.client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    this.user.set(result.data.user);
    await this.loadProfile();
  }

  async register(email: string, password: string, fullName: string) {
    const result = await this.db.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (result.error) throw result.error;
    return result;
  }

  async logout() {
    await this.db.client.auth.signOut();
    this.user.set(null);
    this.profile.set(null);
  }

  async loadProfile() {
    const u = this.user();
    if (!u) {
      this.profile.set(null);
      return;
    }
    const { data, error } = await this.db.client
      .from('profiles')
      .select('id,full_name,role')
      .eq('id', u.id)
      .single();
    if (!error) this.profile.set(data as Profile);
  }

  isAdmin(): boolean {
    return this.profile()?.role === 'ADMIN';
  }
}
