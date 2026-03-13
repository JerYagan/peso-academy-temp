/**
 * Database types for Supabase
 * This file defines the TypeScript types for your Supabase database schema
 * Update this file when you modify your database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'admin' | 'trainer' | 'trainee'
          trainee_type?: 'peso_client' | 'peso_employee' | null
          verification_status: 'pending' | 'verified' | 'rejected'
          employee_id?: string | null
          physical_id?: string | null
          verification_submitted_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verification_notes?: string | null
          onboarding_modal_seen_at?: string | null
          avatar?: string | null
          phone?: string | null
          address?: string | null
          date_of_birth?: string | null
          gender?: string | null
          civil_status?: string | null
          employment_status?: string | null
          occupation?: string | null
          education_level?: string | null
          barangay?: string | null
          city_municipality?: string | null
          province?: string | null
          postal_code?: string | null
          industry_interests?: string[] | null
          preferred_categories?: string[] | null
          onboarding_skill_level?: string | null
          language_preference?: string | null
          theme_preference?: string | null
          skills?: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'admin' | 'trainer' | 'trainee'
          trainee_type?: 'peso_client' | 'peso_employee' | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          employee_id?: string | null
          physical_id?: string | null
          verification_submitted_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verification_notes?: string | null
          onboarding_modal_seen_at?: string | null
          avatar?: string | null
          phone?: string | null
          address?: string | null
          date_of_birth?: string | null
          gender?: string | null
          civil_status?: string | null
          employment_status?: string | null
          occupation?: string | null
          education_level?: string | null
          barangay?: string | null
          city_municipality?: string | null
          province?: string | null
          postal_code?: string | null
          industry_interests?: string[] | null
          preferred_categories?: string[] | null
          onboarding_skill_level?: string | null
          language_preference?: string | null
          theme_preference?: string | null
          skills?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'admin' | 'trainer' | 'trainee'
          trainee_type?: 'peso_client' | 'peso_employee' | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          employee_id?: string | null
          physical_id?: string | null
          verification_submitted_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verification_notes?: string | null
          onboarding_modal_seen_at?: string | null
          avatar?: string | null
          phone?: string | null
          address?: string | null
          date_of_birth?: string | null
          gender?: string | null
          civil_status?: string | null
          employment_status?: string | null
          occupation?: string | null
          education_level?: string | null
          barangay?: string | null
          city_municipality?: string | null
          province?: string | null
          postal_code?: string | null
          industry_interests?: string[] | null
          preferred_categories?: string[] | null
          onboarding_skill_level?: string | null
          language_preference?: string | null
          theme_preference?: string | null
          skills?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      system_settings: {
        Row: {
          key: string
          value_json: Json
          description?: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value_json?: Json
          description?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value_json?: Json
          description?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string
          category: string
          level: 'Beginner' | 'Intermediate' | 'Advanced'
          duration: number
          instructor_id: string
          thumbnail?: string | null
          is_tesda_accredited: boolean
          skills: string[]
          industry_tags?: string[] | null
          career_paths?: string[] | null
          enrolled_count: number
          rating: number
          certificate_type: 'completion' | 'participation'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          category: string
          level: 'Beginner' | 'Intermediate' | 'Advanced'
          duration: number
          instructor_id: string
          thumbnail?: string | null
          is_tesda_accredited?: boolean
          skills: string[]
          industry_tags?: string[] | null
          career_paths?: string[] | null
          enrolled_count?: number
          rating?: number
          certificate_type?: 'completion' | 'participation'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          category?: string
          level?: 'Beginner' | 'Intermediate' | 'Advanced'
          duration?: number
          instructor_id?: string
          thumbnail?: string | null
          is_tesda_accredited?: boolean
          skills?: string[]
          industry_tags?: string[] | null
          career_paths?: string[] | null
          enrolled_count?: number
          rating?: number
          certificate_type?: 'completion' | 'participation'
          created_at?: string
          updated_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string
          order: number
          content?: string | null
          materials?: string[] | null
          prerequisites?: string[] | null
          module_thumbnail?: string | null
          created_at: string
          updated_at?: string
          status?: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description: string
          order: number
          content?: string | null
          materials?: string[] | null
          prerequisites?: string[] | null
          module_thumbnail?: string | null
          created_at?: string
          updated_at?: string
          status?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          description?: string
          order?: number
          content?: string | null
          materials?: string[] | null
          prerequisites?: string[] | null
          module_thumbnail?: string | null
          created_at?: string
          updated_at?: string
          status?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          progress: number
          status: 'enrolled' | 'in-progress' | 'completed' | 'dropped'
          enrolled_at: string
          completed_at?: string | null
          certificate_id?: string | null
          completion_approval_status?: 'not_ready' | 'pending' | 'approved' | 'needs_revision' | null
          completion_requested_at?: string | null
          completion_reviewed_at?: string | null
          completion_reviewed_by?: string | null
          completion_feedback?: string | null
          credited_duration_hours?: number | null
          actual_learning_minutes?: number | null
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          progress?: number
          status?: 'enrolled' | 'in-progress' | 'completed' | 'dropped'
          enrolled_at?: string
          completed_at?: string | null
          certificate_id?: string | null
          completion_approval_status?: 'not_ready' | 'pending' | 'approved' | 'needs_revision' | null
          completion_requested_at?: string | null
          completion_reviewed_at?: string | null
          completion_reviewed_by?: string | null
          completion_feedback?: string | null
          credited_duration_hours?: number | null
          actual_learning_minutes?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          progress?: number
          status?: 'enrolled' | 'in-progress' | 'completed' | 'dropped'
          enrolled_at?: string
          completed_at?: string | null
          certificate_id?: string | null
          completion_approval_status?: 'not_ready' | 'pending' | 'approved' | 'needs_revision' | null
          completion_requested_at?: string | null
          completion_reviewed_at?: string | null
          completion_reviewed_by?: string | null
          completion_feedback?: string | null
          credited_duration_hours?: number | null
          actual_learning_minutes?: number | null
          updated_at?: string
        }
      }
      module_completions: {
        Row: {
          id: string
          enrollment_id: string
          module_id: string
          completed_at?: string | null
          time_spent?: number | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          module_id: string
          completed_at?: string | null
          time_spent?: number | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          module_id?: string
          completed_at?: string | null
          time_spent?: number | null
        }
      }
      module_sessions: {
        Row: {
          id: string
          user_id: string
          enrollment_id: string
          course_id: string
          module_id: string
          session_date: string
          started_at: string
          last_seen_at: string
          ended_at?: string | null
          duration_seconds: number
          session_status: 'active' | 'completed' | 'abandoned' | 'timed_out'
          entry_source?: string | null
          resume_position_seconds?: number | null
          metadata?: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enrollment_id: string
          course_id: string
          module_id: string
          session_date?: string
          started_at?: string
          last_seen_at?: string
          ended_at?: string | null
          duration_seconds?: number
          session_status?: 'active' | 'completed' | 'abandoned' | 'timed_out'
          entry_source?: string | null
          resume_position_seconds?: number | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enrollment_id?: string
          course_id?: string
          module_id?: string
          session_date?: string
          started_at?: string
          last_seen_at?: string
          ended_at?: string | null
          duration_seconds?: number
          session_status?: 'active' | 'completed' | 'abandoned' | 'timed_out'
          entry_source?: string | null
          resume_position_seconds?: number | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          enrollment_id: string
          module_id: string
          user_id: string
          file_path?: string | null
          submitted_at: string
          status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
          feedback?: string | null
          validator_id?: string | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          module_id: string
          user_id: string
          file_path?: string | null
          submitted_at?: string
          status?: 'pending' | 'approved' | 'rejected' | 'revision_requested'
          feedback?: string | null
          validator_id?: string | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          module_id?: string
          user_id?: string
          file_path?: string | null
          submitted_at?: string
          status?: 'pending' | 'approved' | 'rejected' | 'revision_requested'
          feedback?: string | null
          validator_id?: string | null
        }
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          course_id: string
          certificate_number: string
          certificate_type: 'completion' | 'participation'
          issued_at: string
          verification_code: string
          issued_by?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          certificate_number: string
          certificate_type: 'completion' | 'participation'
          issued_at?: string
          verification_code: string
          issued_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          certificate_number?: string
          certificate_type?: 'completion' | 'participation'
          issued_at?: string
          verification_code?: string
          issued_by?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          message?: string
          read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'jobseeker' | 'admin' | 'trainer' | 'employer' | 'validator' | 'spd'
      course_level: 'Beginner' | 'Intermediate' | 'Advanced'
      enrollment_status: 'enrolled' | 'in-progress' | 'completed' | 'dropped'
      submission_status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
      certificate_type: 'completion' | 'participation'
    }
  }
}

