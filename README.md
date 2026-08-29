# PocketsFull Telegram Mini App

Static Telegram Mini App frontend backed by a Supabase Edge Function. No database is used.

## Flow

Telegram Mini App -> signed `initData` -> Supabase Edge Function -> verified Telegram user -> stable HMAC UID -> PocketsFull earn wall.

## Supabase Edge Function

`https://lfnjernrgkdtfetyoghq.supabase.co/functions/v1/pocketsfull-telegram`

## Required Supabase secrets

- `TELEGRAM_BOT_TOKEN`
- `POCKETSFULL_KEY`
- `POCKETSFULL_UID_SECRET`
- `TELEGRAM_POST_SECRET`
- optional `TELEGRAM_CHANNEL=@pocketsfull`
- optional `TELEGRAM_INIT_MAX_AGE_SECONDS=3600`

Do not put secrets in this repository or frontend JavaScript.
