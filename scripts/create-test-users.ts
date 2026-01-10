/**
 * Script to create test users in Supabase
 * 
 * Usage:
 * 1. Make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment
 * 2. Run: npx tsx scripts/create-test-users.ts
 * 
 * Or use the Supabase Dashboard method (see TEST_USERS_SETUP.md)
 */

import { createClient } from '@supabase/supabase-js';

// Test users configuration
const TEST_USERS = [
  {
    email: 'jobseeker@peso.academy',
    password: 'password123',
    name: 'Juan Dela Cruz',
    role: 'jobseeker' as const,
    phone: '+63 912 345 6789',
    address: 'Manila, Philippines',
    skills: ['Basic Computer Skills', 'Communication', 'Customer Service'],
  },
  {
    email: 'admin@peso.academy',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin' as const,
    phone: '+63 912 345 6788',
    address: 'Manila, Philippines',
  },
  {
    email: 'trainer@peso.academy',
    password: 'trainer123',
    name: 'Trainer Maria',
    role: 'trainer' as const,
    phone: '+63 912 345 6787',
    address: 'Manila, Philippines',
    skills: ['Training', 'Course Development', 'Education'],
  },
  {
    email: 'employer@peso.academy',
    password: 'employer123',
    name: 'ABC Company',
    role: 'employer' as const,
    phone: '+63 912 345 6786',
    address: 'Makati, Philippines',
  },
  {
    email: 'validator@peso.academy',
    password: 'validator123',
    name: 'Validator John',
    role: 'validator' as const,
    phone: '+63 912 345 6785',
    address: 'Manila, Philippines',
    skills: ['Validation', 'Quality Assurance'],
  },
  {
    email: 'spd@peso.academy',
    password: 'spd123',
    name: 'SPD Manager',
    role: 'spd' as const,
    phone: '+63 912 345 6784',
    address: 'Manila, Philippines',
    skills: ['Program Management', 'Content Development'],
  },
];

async function createTestUsers() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables:');
    console.error('   VITE_SUPABASE_URL or SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n💡 Get your service role key from: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  // Create admin client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🚀 Creating test users...\n');

  for (const userData of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(userData.email);

      if (existingUser?.user) {
        console.log(`⚠️  User ${userData.email} already exists, updating profile...`);
        
        // Update user profile
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: existingUser.user.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            phone: userData.phone || null,
            address: userData.address || null,
            skills: userData.skills || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id',
          });

        if (profileError) {
          console.error(`❌ Failed to update profile for ${userData.email}:`, profileError.message);
        } else {
          console.log(`✅ Updated profile for ${userData.email} (${userData.role})`);
        }
      } else {
        // Create new user
        const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: userData.name,
            role: userData.role,
          },
        });

        if (authError) {
          console.error(`❌ Failed to create auth user ${userData.email}:`, authError.message);
          continue;
        }

        if (!newUser.user) {
          console.error(`❌ No user returned for ${userData.email}`);
          continue;
        }

        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: newUser.user.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            phone: userData.phone || null,
            address: userData.address || null,
            skills: userData.skills || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error(`❌ Failed to create profile for ${userData.email}:`, profileError.message);
          // Try to clean up auth user
          await supabase.auth.admin.deleteUser(newUser.user.id);
        } else {
          console.log(`✅ Created user ${userData.email} (${userData.role})`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${userData.email}:`, error);
    }
  }

  console.log('\n✨ Test users setup complete!');
  console.log('\n📋 Test Credentials:');
  TEST_USERS.forEach(user => {
    console.log(`   ${user.email} / ${user.password} (${user.role})`);
  });
}

// Run the script
createTestUsers().catch(console.error);

