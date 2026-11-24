export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adult_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      adult_profiles: {
        Row: {
          alias: string
          bio: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          alias: string
          bio?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          alias?: string
          bio?: string | null
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_private: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      bounties: {
        Row: {
          active: boolean
          created_at: string
          creator_id: string
          deposit: number
          followers_paid: number
          id: string
          per_follow: number
          remaining: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          creator_id: string
          deposit: number
          followers_paid?: number
          id?: string
          per_follow?: number
          remaining: number
        }
        Update: {
          active?: boolean
          created_at?: string
          creator_id?: string
          deposit?: number
          followers_paid?: number
          id?: string
          per_follow?: number
          remaining?: number
        }
        Relationships: []
      }
      call_invitations: {
        Row: {
          audio: boolean
          caller_id: string
          created_at: string
          id: string
          receiver_id: string
          status: string
        }
        Insert: {
          audio?: boolean
          caller_id: string
          created_at?: string
          id?: string
          receiver_id: string
          status?: string
        }
        Update: {
          audio?: boolean
          caller_id?: string
          created_at?: string
          id?: string
          receiver_id?: string
          status?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          theme: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          theme?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          theme?: string
        }
        Relationships: []
      }
      chat_queue: {
        Row: {
          audio: boolean
          call_id: string | null
          mode: string
          peer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio?: boolean
          call_id?: string | null
          mode: string
          peer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio?: boolean
          call_id?: string | null
          mode?: string
          peer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_events: {
        Row: {
          app_version: string | null
          created_at: string
          id: number
          kind: string
          message: string | null
          name: string
          path: string | null
          platform: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: never
          kind: string
          message?: string | null
          name: string
          path?: string | null
          platform?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: never
          kind?: string
          message?: string | null
          name?: string
          path?: string | null
          platform?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      creator_payout_accounts: {
        Row: {
          account_number: string
          active: boolean
          business_name: string
          created_at: string
          paystack_subaccount_code: string | null
          percentage_charge: number
          settlement_bank: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          active?: boolean
          business_name: string
          created_at?: string
          paystack_subaccount_code?: string | null
          percentage_charge?: number
          settlement_bank: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          active?: boolean
          business_name?: string
          created_at?: string
          paystack_subaccount_code?: string | null
          percentage_charge?: number
          settlement_bank?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          created_at: string
          monthly_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          monthly_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          monthly_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_subscriptions: {
        Row: {
          amount: number
          canceled_at: string | null
          creator_id: string
          expires_at: string
          id: string
          started_at: string
          status: string
          subscriber_id: string
        }
        Insert: {
          amount: number
          canceled_at?: string | null
          creator_id: string
          expires_at: string
          id?: string
          started_at?: string
          status?: string
          subscriber_id: string
        }
        Update: {
          amount?: number
          canceled_at?: string | null
          creator_id?: string
          expires_at?: string
          id?: string
          started_at?: string
          status?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      crushes: {
        Row: {
          created_at: string
          id: string
          revealed: boolean
          sender_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revealed?: boolean
          sender_id?: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revealed?: boolean
          sender_id?: string
          target_id?: string
        }
        Relationships: []
      }
      daily_drops: {
        Row: {
          caption: string | null
          created_at: string
          drop_date: string
          duration_s: number | null
          id: string
          kind: string
          media_url: string | null
          song_art_url: string | null
          song_artist: string | null
          song_title: string | null
          song_url: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          drop_date: string
          duration_s?: number | null
          id?: string
          kind: string
          media_url?: string | null
          song_art_url?: string | null
          song_artist?: string | null
          song_title?: string | null
          song_url?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          drop_date?: string
          duration_s?: number | null
          id?: string
          kind?: string
          media_url?: string | null
          song_art_url?: string | null
          song_artist?: string | null
          song_title?: string | null
          song_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      group_calls: {
        Row: {
          audio: boolean
          created_at: string
          group_id: string
          id: string
          started_by: string
          status: string
        }
        Insert: {
          audio?: boolean
          created_at?: string
          group_id: string
          id?: string
          started_by?: string
          status?: string
        }
        Update: {
          audio?: boolean
          created_at?: string
          group_id?: string
          id?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_calls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          group_id: string
          id: string
          media_type: string | null
          media_url: string | null
          reactions: Json
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          reactions?: Json
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          reactions?: Json
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_streaks: {
        Row: {
          current_streak: number
          group_id: string
          last_day: string | null
          longest_streak: number
        }
        Insert: {
          current_streak?: number
          group_id: string
          last_day?: string | null
          longest_streak?: number
        }
        Update: {
          current_streak?: number
          group_id?: string
          last_day?: string | null
          longest_streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_streaks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangout_answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "hangout_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_prompts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          expires_at: string
          group_id: string
          id: string
          kind: string
          options: Json | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          kind: string
          options?: Json | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          kind?: string
          options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hangout_prompts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_votes: {
        Row: {
          choice: number
          prompt_id: string
          user_id: string
        }
        Insert: {
          choice: number
          prompt_id: string
          user_id: string
        }
        Update: {
          choice?: number
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangout_votes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "hangout_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          platform: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          platform?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          platform?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      live_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          ended_at: string | null
          host_id: string
          id: string
          peak_viewers: number
          started_at: string
          status: string
          title: string | null
        }
        Insert: {
          ended_at?: string | null
          host_id: string
          id?: string
          peak_viewers?: number
          started_at?: string
          status?: string
          title?: string | null
        }
        Update: {
          ended_at?: string | null
          host_id?: string
          id?: string
          peak_viewers?: number
          started_at?: string
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          price: number
          seller_id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price: number
          seller_id?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number
          seller_id?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          hidden_by: string[]
          id: string
          media_type: string | null
          media_url: string | null
          notified_at: string | null
          ppv_item_id: string | null
          reactions: Json
          read: boolean
          receiver_id: string
          reply_to: string | null
          sender_id: string
          shared_ref: string | null
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hidden_by?: string[]
          id?: string
          media_type?: string | null
          media_url?: string | null
          notified_at?: string | null
          ppv_item_id?: string | null
          reactions?: Json
          read?: boolean
          receiver_id: string
          reply_to?: string | null
          sender_id: string
          shared_ref?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hidden_by?: string[]
          id?: string
          media_type?: string | null
          media_url?: string | null
          notified_at?: string | null
          ppv_item_id?: string | null
          reactions?: Json
          read?: boolean
          receiver_id?: string
          reply_to?: string | null
          sender_id?: string
          shared_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_ppv_item_id_fkey"
            columns: ["ppv_item_id"]
            isOneToOne: false
            referencedRelation: "ppv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_topups: {
        Row: {
          amount: number
          checkout_request_id: string
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          paid_at: string | null
          phone: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_request_id: string
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          paid_at?: string | null
          phone: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          paid_at?: string | null
          phone?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      music_tracks: {
        Row: {
          artist: string | null
          audio_url: string
          cover_url: string | null
          created_at: string
          duration: number | null
          id: string
          plays: number
          title: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          audio_url: string
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          plays?: number
          title: string
          user_id: string
        }
        Update: {
          artist?: string | null
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          plays?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pair_streaks: {
        Row: {
          current_streak: number
          last_day: string | null
          longest_streak: number
          user_a: string
          user_b: string
        }
        Insert: {
          current_streak?: number
          last_day?: string | null
          longest_streak?: number
          user_a: string
          user_b: string
        }
        Update: {
          current_streak?: number
          last_day?: string | null
          longest_streak?: number
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      post_boosts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          placement: string
          post_id: string
          price: number
          target_views: number
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          placement: string
          post_id: string
          price: number
          target_views: number
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          placement?: string
          post_id?: string
          price?: number
          target_views?: number
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_boosts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_viewers: {
        Row: {
          created_at: string
          post_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_viewers_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          allow_comments: boolean
          allow_download: boolean
          caption: string | null
          created_at: string
          hide_likes: boolean
          id: string
          is_adult: boolean
          likes_count: number
          location: string | null
          media_items: Json | null
          media_type: string | null
          media_url: string | null
          music_art_url: string | null
          music_artist: string | null
          music_len: number
          music_start: number
          music_title: string | null
          music_url: string | null
          music_volume: number
          music_youtube_id: string | null
          ppv_item_id: string | null
          thumbnail_url: string | null
          user_id: string
          views_count: number
          visibility: string
        }
        Insert: {
          allow_comments?: boolean
          allow_download?: boolean
          caption?: string | null
          created_at?: string
          hide_likes?: boolean
          id?: string
          is_adult?: boolean
          likes_count?: number
          location?: string | null
          media_items?: Json | null
          media_type?: string | null
          media_url?: string | null
          music_art_url?: string | null
          music_artist?: string | null
          music_len?: number
          music_start?: number
          music_title?: string | null
          music_url?: string | null
          music_volume?: number
          music_youtube_id?: string | null
          ppv_item_id?: string | null
          thumbnail_url?: string | null
          user_id: string
          views_count?: number
          visibility?: string
        }
        Update: {
          allow_comments?: boolean
          allow_download?: boolean
          caption?: string | null
          created_at?: string
          hide_likes?: boolean
          id?: string
          is_adult?: boolean
          likes_count?: number
          location?: string | null
          media_items?: Json | null
          media_type?: string | null
          media_url?: string | null
          music_art_url?: string | null
          music_artist?: string | null
          music_len?: number
          music_start?: number
          music_title?: string | null
          music_url?: string | null
          music_volume?: number
          music_youtube_id?: string | null
          ppv_item_id?: string | null
          thumbnail_url?: string | null
          user_id?: string
          views_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_ppv_item_id_fkey"
            columns: ["ppv_item_id"]
            isOneToOne: false
            referencedRelation: "ppv_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ppv_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          media_path: string
          media_type: string
          owner_id: string
          price_kes: number
          receiver_id: string | null
          teaser: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          media_path: string
          media_type: string
          owner_id: string
          price_kes: number
          receiver_id?: string | null
          teaser?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          media_path?: string
          media_type?: string
          owner_id?: string
          price_kes?: number
          receiver_id?: string | null
          teaser?: string | null
        }
        Relationships: []
      }
      ppv_unlocks: {
        Row: {
          buyer_id: string
          created_at: string
          fee_kes: number
          item_id: string
          price_kes: number
        }
        Insert: {
          buyer_id: string
          created_at?: string
          fee_kes: number
          item_id: string
          price_kes: number
        }
        Update: {
          buyer_id?: string
          created_at?: string
          fee_kes?: number
          item_id?: string
          price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppv_unlocks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ppv_items"
            referencedColumns: ["id"]
          },
        ]
      }
      prime_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          price: number
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          price: number
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          price?: number
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_aesthetics: {
        Row: {
          accent: string
          font: string
          glass_opacity: number
          pinned_art_url: string | null
          pinned_artist: string | null
          pinned_audio_url: string | null
          pinned_title: string | null
          ring: string
          status_text: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string
          font?: string
          glass_opacity?: number
          pinned_art_url?: string | null
          pinned_artist?: string | null
          pinned_audio_url?: string | null
          pinned_title?: string | null
          ring?: string
          status_text?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string
          font?: string
          glass_opacity?: number
          pinned_art_url?: string | null
          pinned_artist?: string | null
          pinned_audio_url?: string | null
          pinned_title?: string | null
          ring?: string
          status_text?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adult_verified_at: string | null
          avatar_url: string | null
          badge: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_official: boolean
          is_verified: boolean
          onboarded_at: string | null
          referral_code: string
          referral_count: number
          referred_by: string | null
          tz: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          adult_verified_at?: string | null
          avatar_url?: string | null
          badge?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_official?: boolean
          is_verified?: boolean
          onboarded_at?: string | null
          referral_code?: string
          referral_count?: number
          referred_by?: string | null
          tz?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          adult_verified_at?: string | null
          avatar_url?: string | null
          badge?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_official?: boolean
          is_verified?: boolean
          onboarded_at?: string | null
          referral_code?: string
          referral_count?: number
          referred_by?: string | null
          tz?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reel_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reel_id: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_likes: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_reposts: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_reposts_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_saves: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_saves_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_viewers: {
        Row: {
          created_at: string
          reel_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_viewers_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          allow_comments: boolean
          allow_download: boolean
          caption: string | null
          created_at: string
          hide_likes: boolean
          id: string
          likes_count: number
          location: string | null
          music_art_url: string | null
          music_artist: string | null
          music_len: number
          music_start: number
          music_title: string | null
          music_url: string | null
          music_volume: number
          source_post_id: string | null
          thumbnail_url: string | null
          user_id: string
          video_url: string | null
          video_volume: number
          views_count: number
          visibility: string
        }
        Insert: {
          allow_comments?: boolean
          allow_download?: boolean
          caption?: string | null
          created_at?: string
          hide_likes?: boolean
          id?: string
          likes_count?: number
          location?: string | null
          music_art_url?: string | null
          music_artist?: string | null
          music_len?: number
          music_start?: number
          music_title?: string | null
          music_url?: string | null
          music_volume?: number
          source_post_id?: string | null
          thumbnail_url?: string | null
          user_id: string
          video_url?: string | null
          video_volume?: number
          views_count?: number
          visibility?: string
        }
        Update: {
          allow_comments?: boolean
          allow_download?: boolean
          caption?: string | null
          created_at?: string
          hide_likes?: boolean
          id?: string
          likes_count?: number
          location?: string | null
          music_art_url?: string | null
          music_artist?: string | null
          music_len?: number
          music_start?: number
          music_title?: string | null
          music_url?: string | null
          music_volume?: number
          source_post_id?: string | null
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string | null
          video_volume?: number
          views_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_bonuses: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          transaction_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          transaction_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_bonuses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_withdrawals: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          phone: string
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          phone: string
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          phone?: string
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          category: string
          created_at: string
          details: Json
          event: string
          id: string
          target: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json
          event: string
          id?: string
          target?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json
          event?: string
          id?: string
          target?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_kes: number
          creator_id: string
          expires_at: string
          id: string
          last_reference: string | null
          started_at: string
          status: string
          subscriber_id: string
        }
        Insert: {
          amount_kes: number
          creator_id: string
          expires_at: string
          id?: string
          last_reference?: string | null
          started_at?: string
          status?: string
          subscriber_id: string
        }
        Update: {
          amount_kes?: number
          creator_id?: string
          expires_at?: string
          id?: string
          last_reference?: string | null
          started_at?: string
          status?: string
          subscriber_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          buyer_id: string | null
          channel: string | null
          created_at: string
          creator_id: string | null
          creator_net_kes: number
          gross_kes: number
          id: string
          payment_type: string
          paystack_fee_kes: number
          platform_fee_kes: number
          raw: Json | null
          reference: string
          status: string
          track_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          channel?: string | null
          created_at?: string
          creator_id?: string | null
          creator_net_kes: number
          gross_kes: number
          id?: string
          payment_type: string
          paystack_fee_kes?: number
          platform_fee_kes: number
          raw?: Json | null
          reference: string
          status?: string
          track_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          channel?: string | null
          created_at?: string
          creator_id?: string | null
          creator_net_kes?: number
          gross_kes?: number
          id?: string
          payment_type?: string
          paystack_fee_kes?: number
          platform_fee_kes?: number
          raw?: Json | null
          reference?: string
          status?: string
          track_id?: string | null
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_at: string
          banned_by: string | null
          expires_at: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          expires_at?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          expires_at?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_perks: {
        Row: {
          perk: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          perk: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          perk?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          allow_dms: boolean
          allow_tags: boolean
          is_private: boolean
          prefs: Json
          show_activity: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_dms?: boolean
          allow_tags?: boolean
          is_private?: boolean
          prefs?: Json
          show_activity?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_dms?: boolean
          allow_tags?: boolean
          is_private?: boolean
          prefs?: Json
          show_activity?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number
          last_drop_date: string | null
          longest_streak: number
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_drop_date?: string | null
          longest_streak?: number
          user_id: string
        }
        Update: {
          current_streak?: number
          last_drop_date?: string | null
          longest_streak?: number
          user_id?: string
        }
        Relationships: []
      }
      video_chat_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: []
      }
      wallet_pins: {
        Row: {
          failed: number
          locked_until: string | null
          pin_hash: string
          updated_at: string
          user_id: string
          verified_until: string | null
        }
        Insert: {
          failed?: number
          locked_until?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
          verified_until?: string | null
        }
        Update: {
          failed?: number
          locked_until?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
          verified_until?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          counterparty?: string | null
          created_at?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          risk_flags: string[]
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone: string
          processed_at?: string | null
          processed_by?: string | null
          risk_flags?: string[]
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone?: string
          processed_at?: string | null
          processed_by?: string | null
          risk_flags?: string[]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      group_streaks_live: {
        Row: {
          current_streak: number | null
          group_id: string | null
          longest_streak: number | null
          tier: string | null
        }
        Insert: {
          current_streak?: never
          group_id?: string | null
          longest_streak?: number | null
          tier?: never
        }
        Update: {
          current_streak?: never
          group_id?: string | null
          longest_streak?: number | null
          tier?: never
        }
        Relationships: [
          {
            foreignKeyName: "group_streaks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_streaks_live: {
        Row: {
          current_streak: number | null
          longest_streak: number | null
          tier: string | null
          user_a: string | null
          user_b: string | null
        }
        Insert: {
          current_streak?: never
          longest_streak?: number | null
          tier?: never
          user_a?: string | null
          user_b?: string | null
        }
        Update: {
          current_streak?: never
          longest_streak?: number | null
          tier?: never
          user_a?: string | null
          user_b?: string | null
        }
        Relationships: []
      }
      user_streaks_live: {
        Row: {
          at_risk: boolean | null
          current_streak: number | null
          longest_streak: number | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          at_risk?: never
          current_streak?: never
          longest_streak?: number | null
          tier?: never
          user_id?: string | null
        }
        Update: {
          at_risk?: never
          current_streak?: never
          longest_streak?: number | null
          tier?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_referral: {
        Args: { _code: string; max_age: string; uid: string }
        Returns: string
      }
      _wallet_spend: {
        Args: { _amt: number; _note: string; _uid: string }
        Returns: undefined
      }
      admin_growth_funnel: { Args: never; Returns: Json }
      admin_list_minor_admins: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          since: string
          user_id: string
          username: string
        }[]
      }
      admin_mark_referral_withdrawal: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      admin_process_withdrawal: {
        Args: {
          _action: string
          _id: string
          _note?: string
          _receipt?: string
        }
        Returns: undefined
      }
      admin_referral_withdrawals: { Args: never; Returns: Json }
      admin_revenue: { Args: never; Returns: Json }
      admin_set_minor_admin: {
        Args: { _on: boolean; _user: string }
        Returns: undefined
      }
      am_i_banned: { Args: never; Returns: boolean }
      are_mutuals: { Args: { a: string; b: string }; Returns: boolean }
      aura_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          aura: number
          avatar_url: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      aura_rank: {
        Args: { _user: string }
        Returns: {
          aura: number
          rank: number
          total_users: number
        }[]
      }
      aura_scores: {
        Args: never
        Returns: {
          aura: number
          user_id: string
        }[]
      }
      bounty_create: { Args: { _deposit: number }; Returns: string }
      chat_find: {
        Args: { _audio?: boolean; _mode: string }
        Returns: {
          call_id: string
          is_caller: boolean
          peer_id: string
          waiting: number
        }[]
      }
      chat_leave: { Args: never; Returns: undefined }
      claim_referral: { Args: { _code: string }; Returns: Json }
      complete_onboarding: { Args: never; Returns: undefined }
      create_chat_group: {
        Args: { _avatar_url: string; _member_ids?: string[]; _name: string }
        Returns: string
      }
      create_group: {
        Args: { _members: string[]; _name: string; _theme?: string }
        Returns: string
      }
      creator_cancel_subscription: {
        Args: { _creator_id: string }
        Returns: undefined
      }
      creator_set_price: { Args: { _price: number }; Returns: undefined }
      creator_subscribe: { Args: { _creator_id: string }; Returns: string }
      creator_unsubscribe: { Args: { _creator_id: string }; Returns: undefined }
      crush_reveal: { Args: { _crush_id: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      gen_referral_code: { Args: never; Returns: string }
      get_friend_drops: {
        Args: { _limit?: number }
        Returns: {
          caption: string
          created_at: string
          drop_date: string
          duration_s: number
          id: string
          kind: string
          locked: boolean
          media_url: string
          mutual: boolean
          song_art_url: string
          song_artist: string
          song_title: string
          song_url: string
          user_id: string
        }[]
      }
      grant_referral_perks: {
        Args: { n: number; uid: string }
        Returns: undefined
      }
      group_add_members: {
        Args: { _gid: string; _members: string[] }
        Returns: undefined
      }
      group_leave: { Args: { _gid: string }; Returns: undefined }
      group_message_delete: { Args: { _id: string }; Returns: undefined }
      group_message_edit: {
        Args: { _content: string; _id: string }
        Returns: undefined
      }
      group_message_react: {
        Args: { _emoji: string; _id: string }
        Returns: Json
      }
      group_set_theme: {
        Args: { _gid: string; _theme: string }
        Returns: undefined
      }
      hangout_answers_for: {
        Args: { _prompt: string }
        Returns: {
          answer: string
          created_at: string
          id: string
          mine: boolean
        }[]
      }
      hangout_poll_results: {
        Args: { _prompt: string }
        Returns: {
          choice: number
          mine: boolean
          votes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_adult_verified: { Args: { _uid: string }; Returns: boolean }
      is_group_member: {
        Args: { _gid: string; _uid: string }
        Returns: boolean
      }
      is_main_admin: { Args: { _uid: string }; Returns: boolean }
      is_minor_admin: { Args: { _uid: string }; Returns: boolean }
      is_staff_user: { Args: { _uid: string }; Returns: boolean }
      live_send_gift: {
        Args: { _amount: number; _gift: string; _stream: string }
        Returns: number
      }
      log_security_event: {
        Args: {
          _category: string
          _details?: Json
          _event: string
          _target?: string
        }
        Returns: undefined
      }
      message_delete: {
        Args: { _for_everyone?: boolean; _id: string }
        Returns: undefined
      }
      message_edit: {
        Args: { _content: string; _id: string }
        Returns: undefined
      }
      message_react: { Args: { _emoji: string; _id: string }; Returns: Json }
      music_play: { Args: { _id: string }; Returns: undefined }
      my_crushes: {
        Args: never
        Returns: {
          created_at: string
          id: string
          revealed: boolean
          sender_avatar: string
          sender_username: string
        }[]
      }
      my_referral_earnings: { Args: never; Returns: Json }
      my_weekly_wrapped: { Args: never; Returns: Json }
      next_streak: {
        Args: { cur: number; last_day: string; today: string }
        Returns: number
      }
      notify_push: {
        Args: { _body: string; _title: string; _url: string; _user: string }
        Returns: undefined
      }
      ppv_can_view: { Args: { _name: string }; Returns: boolean }
      ppv_check_new: {
        Args: { _path: string; _price: number; _type: string }
        Returns: undefined
      }
      ppv_create_post: {
        Args: {
          _caption: string
          _path: string
          _price: number
          _teaser?: string
          _type: string
        }
        Returns: string
      }
      ppv_send_message: {
        Args: {
          _path: string
          _price: number
          _receiver: string
          _teaser?: string
          _type: string
        }
        Returns: string
      }
      ppv_unlock: { Args: { _item: string }; Returns: string }
      prime_boost: {
        Args: { _post_id: string; _tier: string }
        Returns: string
      }
      prime_cancel: { Args: never; Returns: undefined }
      prime_subscribe: { Args: { _tier: string }; Returns: string }
      prime_tier: { Args: { _user_id: string }; Returns: string }
      prime_tip: {
        Args: { _amount: number; _recipient: string }
        Returns: number
      }
      referral_preview: {
        Args: { _code: string }
        Returns: {
          avatar_url: string
          display_name: string
        }[]
      }
      register_post_view: { Args: { _post_id: string }; Returns: number }
      register_push_token: {
        Args: { _platform?: string; _token: string }
        Returns: undefined
      }
      register_reel_view: { Args: { _reel_id: string }; Returns: number }
      request_referral_withdrawal: { Args: { _phone: string }; Returns: Json }
      streak_tier: { Args: { n: number }; Returns: string }
      suggested_people: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          followers: number
          is_official: boolean
          is_verified: boolean
          user_id: string
          username: string
        }[]
      }
      user_today: { Args: { uid: string }; Returns: string }
      verify_adult: { Args: { _dob: string }; Returns: boolean }
      wallet_balance: { Args: { _user_id: string }; Returns: number }
      wallet_cancel_withdrawal: { Args: { _id: string }; Returns: undefined }
      wallet_earnings_summary: { Args: never; Returns: Json }
      wallet_has_pin: { Args: never; Returns: boolean }
      wallet_my_balance: { Args: never; Returns: number }
      wallet_request_withdrawal: {
        Args: { _amount: number; _phone: string }
        Returns: string
      }
      wallet_require_pin: { Args: never; Returns: undefined }
      wallet_send: {
        Args: { _amount: number; _recipient: string }
        Returns: {
          new_balance: number
          transfer_amount: number
        }[]
      }
      wallet_set_pin: {
        Args: { _old?: string; _pin: string }
        Returns: boolean
      }
      wallet_verify_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
