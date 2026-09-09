# Пускане във Vercel

Сайтът се разгръща от този repo. Vercel сам разпознава Astro и адаптера.

## 1. Свържи repo-то

[vercel.com/new](https://vercel.com/new) → **Import** `avdyanov24/edinpodarak-rabotilnitsa`.
Нищо не се променя в настройките за билд — само добави променливите отдолу.

След това всяко бутване в `main` се публикува само.

## 2. Променливи на средата

В **Settings → Environment Variables**, за Production и Preview:

| Име | Стойност | Задължителна |
|---|---|---|
| `ADMIN_SESSION_SECRET` | дълъг случаен низ (`openssl rand -base64 32`) | да — без нея панелът не работи |
| `ADMIN_EMAIL` | твоят имейл | докато няма Supabase |
| `ADMIN_PASSWORD` | силна парола | докато няма Supabase |
| `SITE_URL` | адресът на сайта, напр. `https://rabotilnitsa.edinpodarak.com` | не, но канониклите и sitemap-ът зависят от нея |
| `SUPABASE_URL` | от проекта в Supabase | за да работи записването |
| `SUPABASE_SERVICE_ROLE_KEY` | от проекта в Supabase | за да работи записването |
| `RESEND_API_KEY` | от Resend | не — без нея просто няма имейли |
| `MAIL_FROM` | напр. `Работилница <zapisvane@mail.edinpodarak.com>` | заедно с горната |

`SUPABASE_SERVICE_ROLE_KEY` заобикаля всички правила за достъп. Стои само
във Vercel — никога в кода, никога в променлива с префикс `PUBLIC_`.

## 3. Докато няма Supabase

Без база данни сайтът **не приема записвания** и не се прави, че приема:
формата отваря готов имейл до Джейля, а `/api/register` връща 503. Панелът
показва червена лента. Щом `SUPABASE_URL` и ключът са налице и сайтът се
публикува наново, записването онлайн се включва само — няма промяна в кода.

Стъпките за Supabase са в [SUPABASE.md](SUPABASE.md), около 20 минути.

## 4. Домейнът

**Settings → Domains** → `rabotilnitsa.edinpodarak.com`. Vercel дава CNAME,
който се добавя в Jump.bg (там е DNS-ът на `edinpodarak.com`, не в Sellavi).
Дотогава сайтът живее на адреса `*.vercel.app`.

## 5. Регионът

**Settings → Functions → Region**: избери **Frankfurt (fra1)** — най-близкият
до България. По подразбиране е Вашингтон, което добавя около 100 ms на заявка.
