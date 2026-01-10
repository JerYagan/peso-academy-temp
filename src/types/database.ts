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
          role: 'jobseeker' | 'admin' | 'trainer' | 'employer' | 'validator' | 'spd'
          avatar?: string | null
          phone?: string | null
          address?: string | null
          skills?: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'jobseeker' | 'admin' | 'trainer' | 'employer' | 'validator' | 'spd'
          avatar?: string | null
          phone?: string | null
          address?: string | null
          skills?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'jobseeker' | 'admin' | 'trainer' | 'employer' | 'validator' | 'spd'
          avatar?: string | null
          phone?: string | null
          address?: string | null
          skills?: string[] | null
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
        }
      }
      module_completions: {
        Row: {
          id: string
          enrollment_id: string
          module_id: string
          completed_at: string
          time_spent?: number | null
        }
        Insert: {
          id?: string
          enrollment_id: string
          module_id: string
          completed_at?: string
          time_spent?: number | null
        }
        Update: {
          id?: string
          enrollment_id?: string
          module_id?: string
          completed_at?: string
          time_spent?: number | null
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
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          certificate_number: string
          certificate_type: 'completion' | 'participation'
          issued_at?: string
          verification_code: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          certificate_number?: string
          certificate_type?: 'completion' | 'participation'
          issued_at?: string
          verification_code?: string
        }
      }
      jobs: {
        Row: {
          id: string
          title: string
          company: string
          location: string
          type: 'Full-time' | 'Part-time' | 'Contract'
          salary?: string | null
          description: string
          requirements: string[]
          skills: string[]
          posted_by: string
          posted_at: string
          status: 'open' | 'closed'
        }
        Insert: {
          id?: string
          title: string
          company: string
          location: string
          type: 'Full-time' | 'Part-time' | 'Contract'
          salary?: string | null
          description: string
          requirements: string[]
          skills: string[]
          posted_by: string
          posted_at?: string
          status?: 'open' | 'closed'
        }
        Update: {
          id?: string
          title?: string
          company?: string
          location?: string
          type?: 'Full-time' | 'Part-time' | 'Contract'
          salary?: string | null
          description?: string
          requirements?: string[]
          skills?: string[]
          posted_by?: string
          posted_at?: string
          status?: 'open' | 'closed'
        }
      }
      job_applications: {
        Row: {
          id: string
          job_id: string
          user_id: string
          applied_at: string
          status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          applied_at?: string
          status?: 'pending' | 'reviewed' | 'accepted' | 'rejected'
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          applied_at?: string
          status?: 'pending' | 'reviewed' | 'accepted' | 'rejected'
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
      job_type: 'Full-time' | 'Part-time' | 'Contract'
      job_status: 'open' | 'closed'
      application_status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
    }
  }
}

