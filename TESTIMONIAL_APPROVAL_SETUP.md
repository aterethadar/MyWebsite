# הגדרת אישור המלצות במייל (Approve/Reject)

הפרויקט עודכן כך שהמלצה חדשה:
1. נשלחת לשרת כ-`pending`.
2. שולחת מייל לעסק עם קישורי אישור/דחייה.
3. תוצג באתר רק אחרי אישור.

## 1) יצירת טבלה ב-Supabase

הרץ ב-Supabase SQL Editor:

```sql
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null,
  rating int not null check (rating between 1 and 5),
  image_data text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approve_token text unique,
  reject_token text unique,
  submitted_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderator_action text
);

create index if not exists idx_testimonials_status_submitted_at
on public.testimonials (status, submitted_at desc);
```

## 2) הוספת Environment Variables ב-Vercel

בפרויקט ב-Vercel -> Settings -> Environment Variables הוסף:

- `SUPABASE_URL` = כתובת הפרויקט שלך ב-Supabase (למשל `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` = Service Role Key של Supabase
- `RESEND_API_KEY` = API Key של Resend
- `RESEND_FROM_EMAIL` = כתובת שולח מאומתת ב-Resend
- `SITE_BASE_URL` = כתובת האתר החיה שלך (למשל `https://my-website-vybe.vercel.app`)
- `BUSINESS_EMAIL` = המייל שיקבל את קישורי האישור
- `BUSINESS_NAME` = שם העסק שיופיע בנושא המייל

## 3) אימות דומיין/שולח ב-Resend

- אם משתמשים בכתובת מותאמת אישית, צריך לאמת Domain ב-Resend.
- אפשר להתחיל זמנית עם `onboarding@resend.dev` לבדיקה ראשונית.

## 4) בדיקה ידנית מהירה

1. שלח המלצה חדשה בעמוד "המלצות".
2. בדוק שהגיעה הודעה ל-`BUSINESS_EMAIL` עם כפתורי:
   - "אישור ופרסום באתר"
   - "דחייה"
3. לחץ "אישור ופרסום באתר".
4. רענן את עמוד ההמלצות באתר: ההמלצה אמורה להופיע.

## 5) מה השתנה בקוד

- `index.html`: מעבר מ"פרסום מיידי" לשליחה לאישור (`/api/testimonials/submit`) והצגת מאושרות בלבד (`/api/testimonials/approved`).
- `api/testimonials/submit.js`: יצירת המלצה `pending` + שליחת מייל עם קישורי אישור/דחייה.
- `api/testimonials/moderate.js`: טיפול בלחיצה על קישור approve/reject ועדכון סטטוס.
- `api/testimonials/approved.js`: החזרת המלצות מאושרות בלבד לאתר.

## הערת אבטחה

- קישורי approve/reject הם עם token חד-פעמי.
- אחרי שימוש, ה-token נמחק מהרשומה ולא ניתן להשתמש בו שוב.
