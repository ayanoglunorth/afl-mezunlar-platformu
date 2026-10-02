// Database type definitions matching our Supabase schema

export type UserRole = 'student' | 'alumni' | 'teacher' | 'admin';
export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type MentorshipRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
export type MentorshipAvailability = 'active' | 'unavailable';
export type RegistrationReviewReason = 'forgot_school_number' | 'transferred_from_school';
export type ForumThreadStatus = 'open' | 'hidden' | 'archived';
export type ForumReactionType = 'like' | 'heart' | 'insightful' | 'celebrate' | 'thanks';
export type ForumReactionTargetType = 'thread' | 'post';
export type ForumReportReason = 'spam' | 'abuse' | 'privacy' | 'off_topic' | 'other';
export type ForumReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type EventInterestType = 'team' | 'player' | 'support';

export interface Profile {
  id: string;
  full_name: string;
  nickname: string | null;
  role: UserRole;
  avatar_url: string | null;
  university: string | null;
  department: string | null;
  interests: string[];
  graduation_year: number | null;
  student_number: string | null;
  field_of_study: string | null;
  bio: string | null;
  current_grade: string | null;
  class_section: string | null;
  active_student_registry_entry_id: number | null;
  target_field: string | null;
  target_departments: string[] | null;
  target_universities: string[] | null;
  mentorship_expectations: string[] | null;
  education_status: string | null;
  is_working: boolean;
  company_name: string | null;
  company_logo: string | null;
  work_title: string | null;
  linkedin_url: string | null;
  mentorship_capacity: number;
  mentorship_topics: string[] | null;
  mentorship_availability: MentorshipAvailability;
  is_verified: boolean;
  is_profile_complete: boolean;
  registration_review_reason: RegistrationReviewReason | null;
  registration_registry_entry_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AlumniRegistryEntry {
  id: number;
  sequence_number: number | null;
  student_number: string;
  full_name: string;
  full_name_normalized: string;
  field_of_study: string | null;
  graduation_year: number;
  is_claimed: boolean;
  claimed_by: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface ActiveStudentRegistryEntry {
  id: number;
  student_number: string;
  school_number: string;
  full_name: string;
  full_name_normalized: string;
  current_grade: string;
  class_section: string;
  expected_graduation_year: number;
  is_claimed: boolean;
  claimed_by: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  status: MatchStatus;
  match_score: number;
  match_reasons: string[];
  requested_by: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface MatchWithProfiles extends Match {
  user_a_profile: Profile;
  user_b_profile: Profile;
}

export interface MatchSuggestion {
  id: string;
  for_user: string;
  suggested_user: string;
  score: number;
  reasons: string[];
  is_dismissed: boolean;
  created_at: string;
}

export interface MatchSuggestionWithProfile extends MatchSuggestion {
  suggested_profile: Profile;
}

export interface ChatRoom {
  id: string;
  match_id: string | null;
  user_a: string;
  user_b: string;
  expires_at: string;
  is_expired: boolean;
  created_at: string;
}

export interface ChatRoomWithProfiles extends ChatRoom {
  user_a_profile: Profile;
  user_b_profile: Profile;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender: Profile;
}

export interface MentorshipRequest {
  id: string;
  student_id: string;
  mentor_id: string;
  request_message: string;
  status: MentorshipRequestStatus;
  match_reasons: string[];
  match_score: number;
  created_at: string;
  responded_at: string | null;
  completed_at: string | null;
}

export interface MentorshipConversation {
  id: string;
  request_id: string;
  student_id: string;
  mentor_id: string;
  created_at: string;
  last_message_at: string;
}

export interface MentorshipMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MentorshipReview {
  id: string;
  request_id: string;
  student_id: string;
  mentor_id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
}

export interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  icon_key: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  is_user_created: boolean;
}

export interface ForumTag {
  id: string;
  slug: string;
  name: string;
  color: string;
  category_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ForumThread {
  id: string;
  category_id: string;
  author_id: string | null;
  title: string;
  content: string;
  status: ForumThreadStatus;
  is_pinned: boolean;
  is_locked: boolean;
  is_hidden: boolean;
  is_anonymous: boolean;
  can_edit?: boolean;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  reaction_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
}

export interface ForumThreadWithAuthor extends ForumThread {
  author: Profile;
  category: ForumCategory;
  tags?: ForumTag[];
  user_reactions?: ForumReactionType[];
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string | null;
  content: string;
  parent_post_id: string | null;
  reply_count: number;
  reaction_count: number;
  is_hidden: boolean;
  status: 'open' | 'archived';
  is_anonymous: boolean;
  can_edit?: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForumPostWithAuthor extends ForumPost {
  author: Profile;
  user_reactions?: ForumReactionType[];
  replies?: ForumPostWithAuthor[];
}

export interface ForumReaction {
  id: string;
  user_id: string;
  target_type: ForumReactionTargetType;
  target_thread_id: string | null;
  target_post_id: string | null;
  reaction_type: ForumReactionType;
  created_at: string;
}

export interface ForumMention {
  id: string;
  thread_id: string;
  post_id: string | null;
  mentioned_user_id: string;
  mentioned_by: string;
  created_at: string;
}

export interface ForumPublicMention {
  thread_id: string;
  post_id: string | null;
  id: string;
  full_name: string;
  role: UserRole;
}

export interface ForumReport {
  id: string;
  reporter_id: string;
  target_type: ForumReactionTargetType;
  target_thread_id: string | null;
  target_post_id: string | null;
  reason: ForumReportReason;
  note: string | null;
  status: ForumReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ForumNotification {
  id: string;
  recipient_id: string;
  actor_id: string;
  thread_id: string;
  post_id: string | null;
  kind: 'mention';
  is_read: boolean;
  created_at: string;
}

export interface EventInterest {
  id: string;
  event_key: string;
  user_id: string;
  interest_type: EventInterestType;
  team_name: string | null;
  estimated_player_count: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Upvote {
  id: string;
  user_id: string;
  thread_id: string | null;
  comment_id: string | null;
  created_at: string;
}

export interface AdminPrivilege {
  user_id: string;
  can_manage_admins: boolean;
  granted_by: string | null;
  granted_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProfileNameChangeRequest {
  id: string;
  user_id: string;
  old_full_name: string;
  requested_full_name: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// CSV parsing types
export interface CSVAlumniRow {
  sequenceNumber: number;
  studentNumber: string;
  fullName: string;
  fieldOfStudy: string;
  graduationYear: number;
}

export interface CSVActiveStudentRow {
  studentNumber: string;
  schoolNumber: string;
  fullName: string;
  currentGrade: string;
  classSection: string;
  expectedGraduationYear: number;
}

export interface CSVParseResult {
  success: CSVAlumniRow[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

export interface CSVActiveStudentParseResult {
  success: CSVActiveStudentRow[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

// Supabase Database type helper
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      alumni_registry: {
        Row: AlumniRegistryEntry;
        Insert: Omit<AlumniRegistryEntry, 'id' | 'uploaded_at' | 'full_name_normalized'>;
        Update: Partial<Omit<AlumniRegistryEntry, 'id'>>;
        Relationships: [];
      };
      active_student_registry: {
        Row: ActiveStudentRegistryEntry;
        Insert: Omit<ActiveStudentRegistryEntry, 'id' | 'uploaded_at' | 'full_name_normalized'>;
        Update: Partial<Omit<ActiveStudentRegistryEntry, 'id'>>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, 'id' | 'created_at' | 'responded_at'>;
        Update: Partial<Omit<Match, 'id' | 'created_at'>>;
        Relationships: [];
      };
      match_suggestions: {
        Row: MatchSuggestion;
        Insert: Omit<MatchSuggestion, 'id' | 'created_at'>;
        Update: Partial<Omit<MatchSuggestion, 'id' | 'created_at'>>;
        Relationships: [];
      };
      chat_rooms: {
        Row: ChatRoom;
        Insert: Omit<ChatRoom, 'id' | 'created_at'>;
        Update: Partial<Omit<ChatRoom, 'id' | 'created_at'>>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
        Relationships: [];
      };
      mentorship_requests: {
        Row: MentorshipRequest;
        Insert: Omit<MentorshipRequest, 'id' | 'created_at' | 'responded_at' | 'completed_at'>;
        Update: Partial<Omit<MentorshipRequest, 'id' | 'created_at'>>;
        Relationships: [];
      };
      mentorship_conversations: {
        Row: MentorshipConversation;
        Insert: Omit<MentorshipConversation, 'id' | 'created_at' | 'last_message_at'>;
        Update: Partial<Omit<MentorshipConversation, 'id' | 'created_at'>>;
        Relationships: [];
      };
      mentorship_messages: {
        Row: MentorshipMessage;
        Insert: Omit<MentorshipMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<MentorshipMessage, 'id' | 'created_at'>>;
        Relationships: [];
      };
      mentorship_reviews: {
        Row: MentorshipReview;
        Insert: Omit<MentorshipReview, 'id' | 'created_at'>;
        Update: Partial<Omit<MentorshipReview, 'id' | 'created_at'>>;
        Relationships: [];
      };
      forum_categories: {
        Row: ForumCategory;
        Insert: Omit<ForumCategory, 'id'>;
        Update: Partial<Omit<ForumCategory, 'id'>>;
        Relationships: [];
      };
      forum_tags: {
        Row: ForumTag;
        Insert: Omit<ForumTag, 'id' | 'created_at'>;
        Update: Partial<Omit<ForumTag, 'id' | 'created_at'>>;
        Relationships: [];
      };
      forum_threads: {
        Row: ForumThread;
        Insert: Omit<ForumThread, 'id' | 'created_at' | 'updated_at' | 'upvote_count' | 'comment_count' | 'view_count' | 'reaction_count' | 'last_activity_at' | 'edited_at'>;
        Update: Partial<Omit<ForumThread, 'id' | 'created_at'>>;
        Relationships: [];
      };
      forum_thread_tags: {
        Row: { thread_id: string; tag_id: string; created_at: string };
        Insert: { thread_id: string; tag_id: string };
        Update: never;
        Relationships: [];
      };
      forum_posts: {
        Row: ForumPost;
        Insert: Omit<ForumPost, 'id' | 'created_at' | 'updated_at' | 'reply_count' | 'reaction_count' | 'edited_at'>;
        Update: Partial<Omit<ForumPost, 'id' | 'created_at'>>;
        Relationships: [];
      };
      forum_threads_public: {
        Row: ForumThread;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      forum_posts_public: {
        Row: ForumPost;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      forum_reactions: {
        Row: ForumReaction;
        Insert: Omit<ForumReaction, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      forum_mentions: {
        Row: ForumMention;
        Insert: Omit<ForumMention, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      forum_reports: {
        Row: ForumReport;
        Insert: Omit<ForumReport, 'id' | 'created_at' | 'reviewed_by' | 'reviewed_at'>;
        Update: Partial<Omit<ForumReport, 'id' | 'created_at'>>;
        Relationships: [];
      };
      event_interests: {
        Row: EventInterest;
        Insert: Omit<EventInterest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EventInterest, 'id' | 'created_at'>>;
        Relationships: [];
      };
      forum_comments: {
        Row: {
          id: string;
          thread_id: string;
          author_id: string;
          content: string;
          parent_comment_id: string | null;
          upvote_count: number;
          created_at: string;
        };
        Insert: {
          thread_id: string;
          author_id: string;
          content: string;
          parent_comment_id?: string | null;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      upvotes: {
        Row: Upvote;
        Insert: Omit<Upvote, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      admin_privileges: {
        Row: AdminPrivilege;
        Insert: Omit<AdminPrivilege, 'granted_at' | 'updated_at'>;
        Update: Partial<Omit<AdminPrivilege, 'user_id' | 'granted_at'>>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLog;
        Insert: Omit<AdminAuditLog, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      profile_name_change_requests: {
        Row: ProfileNameChangeRequest;
        Insert: Omit<ProfileNameChangeRequest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProfileNameChangeRequest, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: Omit<Profile, 'student_number' | 'interests' | 'active_student_registry_entry_id'>;
        Relationships: [];
      };
    };
    Functions: {
      accept_mentorship_request: {
        Args: { request_id: string };
        Returns: string;
      };
      mark_social_messages_read: {
        Args: { p_room_id: string };
        Returns: string[];
      };
      mark_mentorship_messages_read: {
        Args: { p_conversation_id: string };
        Returns: string[];
      };
      is_platform_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      forum_is_verified_user: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      forum_is_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      increment_forum_thread_view: {
        Args: { p_thread_id: string };
        Returns: number;
      };
      create_forum_thread_with_details: {
        Args: {
          p_thread_id: string;
          p_category_id: string;
          p_title: string;
          p_content: string;
          p_is_anonymous: boolean;
          p_tag_ids?: string[];
          p_mention_ids?: string[];
        };
        Returns: { thread_id: string; category_slug: string }[];
      };
      create_forum_post_with_mentions: {
        Args: {
          p_post_id: string;
          p_thread_id: string;
          p_parent_post_id: string | null;
          p_content: string;
          p_is_anonymous: boolean;
          p_mention_ids?: string[];
        };
        Returns: { post_id: string; thread_id: string }[];
      };
      edit_forum_thread_content: {
        Args: { p_thread_id: string; p_title: string; p_content: string; p_mention_ids: string[] };
        Returns: { ok: boolean; thread_id: string }[];
      };
      edit_forum_post_content: {
        Args: { p_post_id: string; p_content: string; p_mention_ids: string[] };
        Returns: { ok: boolean; thread_id: string }[];
      };
      get_forum_public_mentions: {
        Args: { p_thread_id: string };
        Returns: ForumPublicMention[];
      };
      get_forum_thread_detail: {
        Args: { p_thread_id: string };
        Returns: Record<string, unknown> | null;
      };
      get_inbox_counts: {
        Args: Record<string, never>;
        Returns: {
          social_unread: number;
          mentor_unread: number;
          forum_unread: number;
          social_request_count: number;
          mentorship_request_count: number;
          unread_messages_total: number;
          pending_matches_total: number;
        }[];
      };
      get_realtime_profile: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          full_name: string;
          nickname: string | null;
          role: UserRole;
          is_admin: boolean;
        }[];
      };
      get_messages_overview: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_mentorship_conversation_detail: {
        Args: { p_conversation_id: string };
        Returns: Record<string, unknown> | null;
      };
      get_social_conversation_detail: {
        Args: { p_room_id: string };
        Returns: Record<string, unknown> | null;
      };
      get_forum_overview: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_forum_threads_list: {
        Args: { p_limit?: number };
        Returns: Record<string, unknown> | null;
      };
      get_social_board_snapshot: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_matching_overview: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      admin_get_dashboard_snapshot: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      admin_get_users_snapshot: {
        Args: { p_query?: string; p_limit?: number; p_offset?: number };
        Returns: Record<string, unknown> | null;
      };
      admin_get_context: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_forum_category_detail: {
        Args: { p_category_slug: string; p_tag_slug?: string; p_sort?: string };
        Returns: Record<string, unknown> | null;
      };
      get_current_profile_edit: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      get_settings_profile: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      submit_profile_name_change: {
        Args: { p_requested_full_name: string };
        Returns: ProfileNameChangeRequest | null;
      };
      admin_review_profile_name_change: {
        Args: { p_request_id: string; p_action: string };
        Returns: boolean;
      };
      admin_list_profile_name_changes: {
        Args: { p_status?: string };
        Returns: Record<string, unknown>[];
      };
      toggle_forum_reaction: {
        Args: { p_target_type: string; p_target_id: string; p_reaction_type: string };
        Returns: { active: boolean }[];
      };
      admin_moderate_forum_content: {
        Args: { p_target_type: string; p_target_id: string; p_action: string };
        Returns: { ok: boolean; thread_id: string | null; deleted: boolean }[];
      };
      can_manage_admins: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      admin_count_alumni_registry: {
        Args: Record<string, never>;
        Returns: number;
      };
      verify_active_student_registration: {
        Args: {
          p_school_number: string;
          p_full_name_normalized: string;
          p_current_grade: string;
          p_class_section: string;
        };
        Returns: Record<string, unknown> | null;
      };
      admin_upsert_active_student_registry: {
        Args: { p_rows: Record<string, unknown>[]; p_file_name?: string; p_parse_error_count?: number };
        Returns: number;
      };
      admin_get_mentorship_dashboard_stats: {
        Args: Record<string, never>;
        Returns: {
          active_conversation_count: number;
          open_request_count: number;
        }[];
      };
      admin_list_conversation_reviews: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          reviewer_id: string;
          reviewer_name: string | null;
          reviewed_user_id: string;
          reviewed_user_name: string | null;
          conversation_kind: 'social' | 'mentorship';
          conversation_id: string;
          rating: number;
          note: string | null;
          created_at: string;
        }[];
      };
      admin_list_alumni_registry: {
        Args: { p_limit?: number };
        Returns: (AlumniRegistryEntry & { has_account: boolean })[];
      };
      admin_list_message_reports: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          reporter_id: string;
          reporter_name: string | null;
          reported_user_id: string;
          reported_user_name: string | null;
          conversation_kind: 'social' | 'mentorship';
          conversation_id: string;
          note: string | null;
          status: string;
          created_at: string;
          messages: {
            message_id: string;
            sender_id: string;
            content_snapshot: string;
            message_created_at: string;
          }[];
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
