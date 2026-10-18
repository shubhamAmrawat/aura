-- Baseline schema of the production database (public schema), taken 2026-10-18 with pg_dump 17.
-- Includes every migration up to 2026-10-17-user-last-active.sql.
-- New empty database: run this with scripts/run-sql.mts, then `pnpm db:migrate --baseline`, then `pnpm db:seed:dev`.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg22.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: wallpaper_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallpaper_format AS ENUM (
    'jpeg',
    'png',
    'webp',
    'avif'
);


--
-- Name: wallpaper_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallpaper_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'hidden'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    idx integer NOT NULL,
    seed bigint NOT NULL,
    provider_request_id text,
    status_url text,
    response_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    starred boolean DEFAULT false NOT NULL,
    width integer,
    height integer,
    bytes integer,
    original_key text,
    preview_key text,
    cost numeric(10,4) NOT NULL,
    error text,
    submitted_at timestamp without time zone,
    completed_at timestamp without time zone,
    wallpaper_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_images_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'ready'::text, 'failed'::text, 'discarded'::text, 'published'::text])))
);


--
-- Name: ai_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid,
    idea text,
    prompt text NOT NULL,
    prompt_json jsonb,
    prompt_version text,
    model text NOT NULL,
    format text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    count integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    cost_estimate numeric(10,4) NOT NULL,
    cost_actual numeric(10,4),
    idempotency_key text,
    error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    finished_at timestamp without time zone,
    CONSTRAINT ai_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    cover_image_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    cover_thumb_url text,
    cover_thumb_source text,
    is_hidden boolean DEFAULT false NOT NULL,
    intro text
);


--
-- Name: category_redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_redirects (
    old_slug text NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: category_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_suggestions (
    wallpaper_id uuid NOT NULL,
    current_category_id uuid,
    suggested_category_id uuid,
    alternative_category_id uuid,
    confidence real NOT NULL,
    current_fits boolean,
    new_category_idea text,
    reason text,
    model text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    resolved_by uuid,
    CONSTRAINT category_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'auto_applied'::text, 'dismissed'::text])))
);


--
-- Name: collection_wallpapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_wallpapers (
    collection_id uuid NOT NULL,
    wallpaper_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    is_public boolean DEFAULT true NOT NULL,
    cover_wallpaper_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    wallpaper_id uuid NOT NULL,
    quality text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'unknown'::text NOT NULL
);


--
-- Name: likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.likes (
    user_id uuid NOT NULL,
    wallpaper_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    attempts integer DEFAULT 0 NOT NULL
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: upload_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_drafts (
    key text NOT NULL,
    admin_id uuid NOT NULL,
    file_url text NOT NULL,
    file_type text NOT NULL,
    file_size_bytes integer NOT NULL,
    metadata jsonb NOT NULL,
    thumb jsonb,
    moderation jsonb NOT NULL,
    analysis jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    bio text,
    is_creator boolean DEFAULT false NOT NULL,
    is_pro boolean DEFAULT false NOT NULL,
    stripe_customer_id text,
    total_downloads integer DEFAULT 0 NOT NULL,
    total_uploads integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    email text NOT NULL,
    password_hash text,
    is_email_verified boolean DEFAULT false NOT NULL,
    contact_no text,
    username_changed_at timestamp without time zone,
    cover_url text,
    google_id text,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp without time zone,
    role text DEFAULT 'user'::text NOT NULL,
    disabled_at timestamp without time zone,
    disabled_reason text,
    disabled_by uuid,
    last_active_at timestamp without time zone,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);


--
-- Name: wallpaper_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallpaper_categories (
    wallpaper_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wallpaper_views_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallpaper_views_daily (
    wallpaper_id uuid NOT NULL,
    day date NOT NULL,
    source text DEFAULT 'unknown'::text NOT NULL,
    views integer DEFAULT 0 NOT NULL
);


--
-- Name: wallpapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallpapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    file_url text NOT NULL,
    cdn_variants jsonb,
    blurhash text NOT NULL,
    dominant_color text NOT NULL,
    palette text[] DEFAULT '{}'::text[] NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    file_size_bytes integer NOT NULL,
    format public.wallpaper_format NOT NULL,
    category_id uuid,
    uploader_id uuid,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_ai_generated boolean DEFAULT false NOT NULL,
    download_count integer DEFAULT 0 NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    status public.wallpaper_status DEFAULT 'pending'::public.wallpaper_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    trending_score real DEFAULT 0 NOT NULL,
    embedding extensions.vector(512),
    text_embedding extensions.vector(512),
    is_mobile boolean DEFAULT false NOT NULL,
    moderation_reason text,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    rejected_at timestamp without time zone,
    review_note text,
    featured_order integer
);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: ai_images ai_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_images
    ADD CONSTRAINT ai_images_pkey PRIMARY KEY (id);


--
-- Name: ai_images ai_images_provider_request_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_images
    ADD CONSTRAINT ai_images_provider_request_id_unique UNIQUE (provider_request_id);


--
-- Name: ai_jobs ai_jobs_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_unique UNIQUE (slug);


--
-- Name: category_redirects category_redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_redirects
    ADD CONSTRAINT category_redirects_pkey PRIMARY KEY (old_slug);


--
-- Name: category_suggestions category_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_pkey PRIMARY KEY (wallpaper_id);


--
-- Name: collection_wallpapers collection_wallpapers_collection_id_wallpaper_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_wallpapers
    ADD CONSTRAINT collection_wallpapers_collection_id_wallpaper_id_pk PRIMARY KEY (collection_id, wallpaper_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: downloads downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downloads
    ADD CONSTRAINT downloads_pkey PRIMARY KEY (id);


--
-- Name: likes likes_user_id_wallpaper_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_wallpaper_id_pk PRIMARY KEY (user_id, wallpaper_id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: upload_drafts upload_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_drafts
    ADD CONSTRAINT upload_drafts_pkey PRIMARY KEY (key);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_google_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: wallpaper_categories wallpaper_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpaper_categories
    ADD CONSTRAINT wallpaper_categories_pkey PRIMARY KEY (wallpaper_id, category_id);


--
-- Name: wallpaper_views_daily wallpaper_views_daily_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpaper_views_daily
    ADD CONSTRAINT wallpaper_views_daily_pk PRIMARY KEY (wallpaper_id, day, source);


--
-- Name: wallpapers wallpapers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_pkey PRIMARY KEY (id);


--
-- Name: admin_actions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_actions_created_at_idx ON public.admin_actions USING btree (created_at);


--
-- Name: ai_images_job_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_images_job_id_idx ON public.ai_images USING btree (job_id);


--
-- Name: ai_images_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_images_status_idx ON public.ai_images USING btree (status);


--
-- Name: ai_jobs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_jobs_created_at_idx ON public.ai_jobs USING btree (created_at);


--
-- Name: category_suggestions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_suggestions_status_idx ON public.category_suggestions USING btree (status);


--
-- Name: downloads_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX downloads_created_at_idx ON public.downloads USING btree (created_at);


--
-- Name: upload_drafts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX upload_drafts_created_at_idx ON public.upload_drafts USING btree (created_at);


--
-- Name: wallpaper_categories_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallpaper_categories_category_idx ON public.wallpaper_categories USING btree (category_id);


--
-- Name: wallpaper_views_daily_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallpaper_views_daily_day_idx ON public.wallpaper_views_daily USING btree (day);


--
-- Name: wallpapers_featured_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallpapers_featured_order_idx ON public.wallpapers USING btree (featured_order) WHERE is_featured;


--
-- Name: wallpapers_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallpapers_status_created_at_idx ON public.wallpapers USING btree (status, created_at);


--
-- Name: admin_actions admin_actions_admin_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_id_users_id_fk FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_images ai_images_job_id_ai_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_images
    ADD CONSTRAINT ai_images_job_id_ai_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id) ON DELETE CASCADE;


--
-- Name: ai_images ai_images_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_images
    ADD CONSTRAINT ai_images_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id) ON DELETE SET NULL;


--
-- Name: ai_jobs ai_jobs_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: category_redirects category_redirects_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_redirects
    ADD CONSTRAINT category_redirects_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_suggestions category_suggestions_alternative_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_alternative_category_id_categories_id_fk FOREIGN KEY (alternative_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: category_suggestions category_suggestions_current_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_current_category_id_categories_id_fk FOREIGN KEY (current_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: category_suggestions category_suggestions_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: category_suggestions category_suggestions_suggested_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_suggested_category_id_categories_id_fk FOREIGN KEY (suggested_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: category_suggestions category_suggestions_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_suggestions
    ADD CONSTRAINT category_suggestions_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id) ON DELETE CASCADE;


--
-- Name: collection_wallpapers collection_wallpapers_collection_id_collections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_wallpapers
    ADD CONSTRAINT collection_wallpapers_collection_id_collections_id_fk FOREIGN KEY (collection_id) REFERENCES public.collections(id);


--
-- Name: collection_wallpapers collection_wallpapers_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_wallpapers
    ADD CONSTRAINT collection_wallpapers_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id);


--
-- Name: collections collections_cover_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_cover_wallpaper_id_wallpapers_id_fk FOREIGN KEY (cover_wallpaper_id) REFERENCES public.wallpapers(id);


--
-- Name: collections collections_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: downloads downloads_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downloads
    ADD CONSTRAINT downloads_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: downloads downloads_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downloads
    ADD CONSTRAINT downloads_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id);


--
-- Name: likes likes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: likes likes_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id) ON DELETE CASCADE;


--
-- Name: site_settings site_settings_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: upload_drafts upload_drafts_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_drafts
    ADD CONSTRAINT upload_drafts_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_disabled_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_disabled_by_users_id_fk FOREIGN KEY (disabled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wallpaper_categories wallpaper_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpaper_categories
    ADD CONSTRAINT wallpaper_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: wallpaper_categories wallpaper_categories_wallpaper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpaper_categories
    ADD CONSTRAINT wallpaper_categories_wallpaper_id_fkey FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id) ON DELETE CASCADE;


--
-- Name: wallpaper_views_daily wallpaper_views_daily_wallpaper_id_wallpapers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpaper_views_daily
    ADD CONSTRAINT wallpaper_views_daily_wallpaper_id_wallpapers_id_fk FOREIGN KEY (wallpaper_id) REFERENCES public.wallpapers(id) ON DELETE CASCADE;


--
-- Name: wallpapers wallpapers_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: wallpapers wallpapers_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: wallpapers wallpapers_uploader_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_uploader_id_users_id_fk FOREIGN KEY (uploader_id) REFERENCES public.users(id);


--
-- Name: downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


