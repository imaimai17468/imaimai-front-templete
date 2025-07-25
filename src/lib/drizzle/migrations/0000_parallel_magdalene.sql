CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
