--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-0+deb12u2)
-- Dumped by pg_dump version 16.8 (Ubuntu 16.8-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: function_generate(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: bareeq_user
--

CREATE FUNCTION public.function_generate(integer, integer, integer) RETURNS TABLE(batch_number integer, numinserted bigint)
    LANGUAGE plpgsql
    AS $_$
declare 
  i record;
  current_record record;
  current_container_id text;
  batch_number integer;
begin
	INSERT INTO runs DEFAULT VALUES returning num into batch_number;
   CREATE temp TABLE TempResult (container_sn text, po_item_sn text) on commit drop;
	for i in 1..$1 loop -- loop over num_containers (2)
		insert into containers(run_id, product_id, capacity) values (batch_number, $3, $2) returning serial_number into current_container_id;
		for j in 1..$2 loop-- loop over capacity (2)
			insert into po_items(run_id, product_id, container_serial_number) values(
				batch_number, $3, current_container_id
			) returning * into current_record;
			insert into TempResult(container_sn, po_item_sn) values (current_record.container_serial_number, current_record.serial_number);
		end loop;
	end loop;
	return query (select batch_number, count(*) from TempResult);
end;
$_$;


ALTER FUNCTION public.function_generate(integer, integer, integer) OWNER TO bareeq_user;

--
-- Name: function_generate(integer, integer, integer, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: bareeq_user
--

CREATE FUNCTION public.function_generate(integer, integer, integer, timestamp with time zone, timestamp with time zone) RETURNS TABLE(batch_number integer, numinserted bigint)
    LANGUAGE plpgsql
    AS $_$
declare 
  i record;
  current_record record;
  current_container_id text;
  batch_number integer;
begin
	INSERT INTO runs DEFAULT VALUES returning num into batch_number;
   CREATE temp TABLE TempResult (container_sn text, po_item_sn text) on commit drop;
	for i in 1..$1 loop -- loop over num_containers (2)
		insert into containers(run_id, capacity) values (batch_number, $2) returning serial_number into current_container_id;
		for j in 1..$2 loop-- loop over capacity (2)
			insert into po_items(run_id, product_id, container_serial_number, production_date, warranty_end_date) values(
				batch_number, $3, current_container_id, $4, $5
			) returning * into current_record;
			insert into TempResult(container_sn, po_item_sn) values (current_record.container_serial_number, current_record.serial_number);
		end loop;
	end loop;
	return query (select batch_number, count(*) from tempResult);
end;
$_$;


ALTER FUNCTION public.function_generate(integer, integer, integer, timestamp with time zone, timestamp with time zone) OWNER TO bareeq_user;

--
-- Name: function_update_container(text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: bareeq_user
--

CREATE FUNCTION public.function_update_container(text, text, timestamp with time zone, timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $_$
begin

-- use transaction for both updates to be single work
-- BEGIN TRANSACTION;

-- update container values
UPDATE containers SET
    soid = COALESCE($2, soid),
    warranty_start_date = COALESCE($3, warranty_start_date),
    warranty_end_date = COALESCE($4, warranty_end_date)
WHERE serial_number = $1
AND  ($2 IS NOT NULL AND $2 IS DISTINCT FROM soid OR
      $3 IS NOT NULL AND $3 IS DISTINCT FROM warranty_start_date OR
      $4 IS NOT NULL AND $4 IS DISTINCT FROM warranty_end_date
 );

end;
$_$;


ALTER FUNCTION public.function_update_container(text, text, timestamp with time zone, timestamp with time zone) OWNER TO bareeq_user;

--
-- Name: function_update_container_with_products(text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: bareeq_user
--

CREATE FUNCTION public.function_update_container_with_products(text, text, timestamp with time zone, timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $_$
declare 
  i record;
  current_record record;
  current_container_id text;
  batch_number integer;
begin

-- use transaction for both updates to be single work
-- BEGIN TRANSACTION;

-- update container values
UPDATE containers SET
    soid = COALESCE($2, soid),
    warranty_start_date = COALESCE($3, warranty_start_date),
    warranty_end_date = COALESCE($4, warranty_end_date)
WHERE serial_number = $1
AND  ($2 IS NOT NULL AND $2 IS DISTINCT FROM soid OR
      $3 IS NOT NULL AND $3 IS DISTINCT FROM warranty_start_date OR
      $4 IS NOT NULL AND $4 IS DISTINCT FROM warranty_end_date
 );
 
-- update products items of that container
-- with _rows as (
	UPDATE po_items SET
		soid = COALESCE($2, soid),
		warranty_start_date = COALESCE($3, warranty_start_date),
		warranty_end_date = COALESCE($4, warranty_end_date)
	WHERE container_serial_number = $1
	AND  ($2 IS NOT NULL AND $2 IS DISTINCT FROM soid OR
		  $3 IS NOT NULL AND $3 IS DISTINCT FROM warranty_start_date OR
		  $4 IS NOT NULL AND $4 IS DISTINCT FROM warranty_end_date
	 );
-- 	returning 1;
-- ),
--  END TRANSACTION;

end;
$_$;


ALTER FUNCTION public.function_update_container_with_products(text, text, timestamp with time zone, timestamp with time zone) OWNER TO bareeq_user;

--
-- Name: function_update_po_item(text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: bareeq_user
--

CREATE FUNCTION public.function_update_po_item(text, text, timestamp with time zone, timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $_$
begin

-- use transaction for both updates to be single work
-- BEGIN TRANSACTION;

-- update container values
UPDATE po_items SET
    soid = COALESCE($2, soid),
    warranty_start_date = COALESCE($3, warranty_start_date),
    warranty_end_date = COALESCE($4, warranty_end_date)
WHERE container_serial_number = $1
AND  ($2 IS NOT NULL AND $2 IS DISTINCT FROM soid OR
      $3 IS NOT NULL AND $3 IS DISTINCT FROM warranty_start_date OR
      $4 IS NOT NULL AND $4 IS DISTINCT FROM warranty_end_date
 );

end;
$_$;


ALTER FUNCTION public.function_update_po_item(text, text, timestamp with time zone, timestamp with time zone) OWNER TO bareeq_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bonus_transactions; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.bonus_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(200) NOT NULL,
    source_customer_id uuid,
    tech_id uuid,
    amount integer,
    note character varying(1000),
    customer_post_balance integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by_id uuid,
    exchange_rate numeric,
    cash numeric,
    tech_post_balance integer,
    cleared_at timestamp with time zone,
    uncleared_at timestamp with time zone,
    CONSTRAINT ck_bonus_transactions_type CHECK (((((type)::text = 'transfer'::text) AND (amount < 0) AND (tech_id IS NOT NULL) AND (source_customer_id IS NOT NULL)) OR (((type)::text = 'adjustment'::text) AND (tech_id IS NULL) AND (source_customer_id IS NOT NULL)) OR (((type)::text = 'tech_adjustment'::text) AND (source_customer_id IS NULL) AND (tech_id IS NOT NULL)) OR (((type)::text = 'redeem'::text) AND (amount < 0) AND (source_customer_id IS NULL) AND (tech_id IS NOT NULL))))
);


ALTER TABLE public.bonus_transactions OWNER TO bareeq_user;

--
-- Name: containers; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.containers (
    serial_number text DEFAULT public.uuid_generate_v4() NOT NULL,
    capacity integer,
    run_id integer,
    warranty_start_date timestamp with time zone,
    warranty_end_date timestamp with time zone,
    soid text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    product_id integer,
    printed_url text,
    opened_container boolean DEFAULT false,
    creation_state character varying(200) DEFAULT 'full'::character varying
);


ALTER TABLE public.containers OWNER TO bareeq_user;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(500) NOT NULL,
    area_code character varying(100) NOT NULL,
    area_name character varying(100),
    subarea_code character varying(100) NOT NULL,
    subarea_name character varying(100),
    mobile character varying(20),
    landline character varying(20),
    status character varying(100),
    code character varying(100) NOT NULL,
    type character varying(100),
    address character varying(500),
    category character varying(100),
    speciality character varying(100),
    account_type character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    bonus_points integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.customers OWNER TO bareeq_user;

--
-- Name: images; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    base64 text NOT NULL
);


ALTER TABLE public.images OWNER TO bareeq_user;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.orders (
    soid text NOT NULL,
    signature json
);


ALTER TABLE public.orders OWNER TO bareeq_user;

--
-- Name: otps; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.otps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    count bigint NOT NULL,
    client_id uuid,
    expire_at timestamp with time zone DEFAULT (now() + '06:00:00'::interval),
    solved boolean DEFAULT false,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type character varying(100) NOT NULL
);


ALTER TABLE public.otps OWNER TO bareeq_user;

--
-- Name: otps_count_seq; Type: SEQUENCE; Schema: public; Owner: bareeq_user
--

ALTER TABLE public.otps ALTER COLUMN count ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.otps_count_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: po_items; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.po_items (
    serial_number text DEFAULT public.uuid_generate_v4() NOT NULL,
    container_serial_number text,
    product_id integer NOT NULL,
    run_id integer,
    created_at timestamp with time zone DEFAULT now(),
    warranty_end_date timestamp with time zone,
    warranty_start_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    soid text,
    printed_url text
);


ALTER TABLE public.po_items OWNER TO bareeq_user;

--
-- Name: products; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.products (
    name text NOT NULL,
    pid integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    warranty_duration integer NOT NULL
);


ALTER TABLE public.products OWNER TO bareeq_user;

--
-- Name: products_pid_seq; Type: SEQUENCE; Schema: public; Owner: bareeq_user
--

ALTER TABLE public.products ALTER COLUMN pid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_pid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: runs; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.runs (
    num integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.runs OWNER TO bareeq_user;

--
-- Name: runs_num_seq; Type: SEQUENCE; Schema: public; Owner: bareeq_user
--

ALTER TABLE public.runs ALTER COLUMN num ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.runs_num_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    step integer NOT NULL,
    min_points_per_transaction integer,
    max_points_per_day integer,
    point_exchange_rate numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.settings OWNER TO bareeq_user;

--
-- Name: technicians; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.technicians (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    nid character varying(20) NOT NULL,
    nid_front_image_id uuid,
    nid_back_image_id uuid,
    mobile character varying(30) NOT NULL,
    optional_mobile character varying(30),
    customer_id uuid NOT NULL,
    active boolean DEFAULT false NOT NULL,
    created_by_id uuid,
    deleted_at timestamp with time zone,
    bonus_points integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.technicians OWNER TO bareeq_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: bareeq_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    device_id text NOT NULL,
    name character varying(200) NOT NULL,
    role character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO bareeq_user;

--
-- Name: view_bonus_transactions_preloaded; Type: VIEW; Schema: public; Owner: bareeq_user
--

CREATE VIEW public.view_bonus_transactions_preloaded AS
 SELECT btx.id,
    btx.type,
    btx.source_customer_id,
    btx.tech_id,
    btx.amount,
    btx.note,
    btx.customer_post_balance,
    btx.created_at,
    btx.updated_at,
    btx.deleted_at,
    btx.created_by_id,
    btx.exchange_rate,
    btx.cash,
    btx.tech_post_balance,
    btx.cleared_at,
    btx.uncleared_at,
    c.id AS customer_id,
    c.name AS customer_name,
    c.code AS customer_code,
    t.name AS tech_name,
    t.mobile AS tech_mobile,
    t.active AS tech_is_active,
    tech_customer.id AS tech_related_customer_id,
    tech_customer.code AS tech_related_customer_code,
    tech_customer.name AS tech_related_customer_name,
    u.id AS creator_id,
    u.name AS creator_name,
    u.role AS creator_role
   FROM ((((public.bonus_transactions btx
     LEFT JOIN public.customers c ON ((c.id = btx.source_customer_id)))
     LEFT JOIN public.technicians t ON ((t.id = btx.tech_id)))
     LEFT JOIN public.customers tech_customer ON ((tech_customer.id = t.customer_id)))
     LEFT JOIN public.users u ON ((u.id = btx.created_by_id)))
  WHERE (btx.deleted_at IS NULL);


ALTER VIEW public.view_bonus_transactions_preloaded OWNER TO bareeq_user;

--
-- Name: view_existing_customers_with_existing_technicians; Type: VIEW; Schema: public; Owner: bareeq_user
--

CREATE VIEW public.view_existing_customers_with_existing_technicians AS
 SELECT t.id,
    t.name,
    t.nid,
    t.nid_front_image_id,
    t.nid_back_image_id,
    t.mobile,
    t.optional_mobile,
    t.customer_id,
    t.active,
    t.created_by_id,
    t.deleted_at,
    t.bonus_points,
    u.id AS creator_id,
    u.device_id AS creator_device_id,
    u.name AS creator_name,
    u.role AS creator_role,
    c.name AS customer_name,
    c.code AS customer_code,
    c.area_code,
    c.area_name,
    c.subarea_code,
    c.subarea_name
   FROM ((public.technicians t
     JOIN public.customers c ON (((c.id = t.customer_id) AND (c.deleted_at IS NULL))))
     LEFT JOIN public.users u ON ((u.id = t.created_by_id)))
  WHERE (t.deleted_at IS NULL);


ALTER VIEW public.view_existing_customers_with_existing_technicians OWNER TO bareeq_user;

--
-- Name: view_warranty_containers; Type: VIEW; Schema: public; Owner: bareeq_user
--

CREATE VIEW public.view_warranty_containers AS
 SELECT c.serial_number,
    c.capacity,
    c.run_id,
    c.warranty_start_date,
    c.warranty_end_date,
    c.soid,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    c.product_id,
    c.printed_url,
    c.opened_container,
    c.creation_state,
    concat('https://warranty.bareeq.lighting/c/', c.serial_number) AS url,
    p.name AS product_name,
    p.warranty_duration AS product_warranty_duration,
    p.created_at AS product_created_at,
    p.updated_at AS product_updated_at
   FROM (public.containers c
     LEFT JOIN public.products p ON (((c.product_id = p.pid) AND (p.deleted_at IS NULL))))
  WHERE (c.deleted_at IS NULL);


ALTER VIEW public.view_warranty_containers OWNER TO bareeq_user;

--
-- Name: view_warranty_po_items; Type: VIEW; Schema: public; Owner: bareeq_user
--

CREATE VIEW public.view_warranty_po_items AS
 SELECT po.serial_number,
    po.container_serial_number,
    po.product_id,
    po.run_id,
    po.created_at,
    po.warranty_end_date,
    po.warranty_start_date,
    po.updated_at,
    po.deleted_at,
    po.soid,
    po.printed_url,
    concat('https://warranty.bareeq.lighting/p/', po.serial_number) AS url,
    p.name AS product_name,
    p.warranty_duration AS product_warranty_duration,
    p.created_at AS product_created_at,
    p.updated_at AS product_updated_at
   FROM (public.po_items po
     LEFT JOIN public.products p ON (((po.product_id = p.pid) AND (p.deleted_at IS NULL))))
  WHERE (po.deleted_at IS NULL);


ALTER VIEW public.view_warranty_po_items OWNER TO bareeq_user;

--
-- Name: bonus_transactions bonus_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.bonus_transactions
    ADD CONSTRAINT bonus_transactions_pkey PRIMARY KEY (id);


--
-- Name: containers containers_pkey1; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_pkey1 PRIMARY KEY (serial_number);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (soid);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: po_items po_items_pkey1; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_pkey1 PRIMARY KEY (serial_number);


--
-- Name: products products_pkey1; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey1 PRIMARY KEY (pid);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (num);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_container_serial_number_trgm; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE INDEX idx_container_serial_number_trgm ON public.po_items USING gin (container_serial_number public.gin_trgm_ops);


--
-- Name: idx_customers_code; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE UNIQUE INDEX idx_customers_code ON public.customers USING btree (code, ((deleted_at IS NULL))) WHERE (deleted_at IS NULL);


--
-- Name: idx_serial_number_trgm; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE INDEX idx_serial_number_trgm ON public.po_items USING gin (serial_number public.gin_trgm_ops);


--
-- Name: idx_soid_trgm; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE INDEX idx_soid_trgm ON public.po_items USING gin (soid public.gin_trgm_ops);


--
-- Name: idx_technicians_mobile_deleted_at; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE UNIQUE INDEX idx_technicians_mobile_deleted_at ON public.technicians USING btree (mobile, ((deleted_at IS NULL))) WHERE (deleted_at IS NULL);


--
-- Name: idx_technicians_nid_deleted_at; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE UNIQUE INDEX idx_technicians_nid_deleted_at ON public.technicians USING btree (nid, ((deleted_at IS NULL))) WHERE (deleted_at IS NULL);


--
-- Name: otps_deleted_at; Type: INDEX; Schema: public; Owner: bareeq_user
--

CREATE INDEX otps_deleted_at ON public.otps USING btree (client_id, id) WHERE (deleted_at IS NULL);


--
-- Name: bonus_transactions bonus_transactions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.bonus_transactions
    ADD CONSTRAINT bonus_transactions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: bonus_transactions bonus_transactions_source_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.bonus_transactions
    ADD CONSTRAINT bonus_transactions_source_customer_id_fkey FOREIGN KEY (source_customer_id) REFERENCES public.customers(id);


--
-- Name: bonus_transactions bonus_transactions_tech_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.bonus_transactions
    ADD CONSTRAINT bonus_transactions_tech_id_fkey FOREIGN KEY (tech_id) REFERENCES public.technicians(id);


--
-- Name: containers containers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(pid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: containers containers_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(num) NOT VALID;


--
-- Name: po_items po_items_container_serial_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_container_serial_number_fkey FOREIGN KEY (container_serial_number) REFERENCES public.containers(serial_number) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: po_items po_items_product_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_product_id_fkey1 FOREIGN KEY (product_id) REFERENCES public.products(pid);


--
-- Name: po_items po_items_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(num) ON UPDATE CASCADE ON DELETE SET DEFAULT NOT VALID;


--
-- Name: technicians technicians_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) NOT VALID;


--
-- Name: technicians technicians_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) NOT VALID;


--
-- Name: technicians technicians_nid_back_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_nid_back_image_id_fkey FOREIGN KEY (nid_back_image_id) REFERENCES public.images(id) NOT VALID;


--
-- Name: technicians technicians_nid_front_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: bareeq_user
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_nid_front_image_id_fkey FOREIGN KEY (nid_front_image_id) REFERENCES public.images(id) NOT VALID;


--
-- PostgreSQL database dump complete
--

