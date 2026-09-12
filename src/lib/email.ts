import { env } from './env';
import { fmtWhen, fmtPrice } from './format';
import type { WorkshopEvent } from './db';

/**
 * Resend, when it is configured. Every function here is a no-op otherwise, so
 * a missing key degrades to "no email was sent" rather than a failed booking.
 * The booking is what matters; the email is a courtesy.
 */

interface Sent { sent: boolean; reason?: string }

async function send(to: string, subject: string, html: string): Promise<Sent> {
  const key = env('RESEND_API_KEY');
  const from = env('MAIL_FROM');
  if (!key || !from) return { sent: false, reason: 'not_configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) return { sent: false, reason: `resend_${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

const shell = (body: string) => `
<div style="font-family:Georgia,'Times New Roman',serif;background:#F4EEE2;padding:28px">
  <div style="max-width:520px;margin:0 auto;background:#FBF8F1;border:1px solid #dfd8c7;border-radius:6px;padding:28px">
    ${body}
    <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e6dfd0;font-size:13px;color:#5C6B60;font-family:system-ui,sans-serif">
      Работилница с Джейля
    </p>
  </div>
</div>`;

const when = (e: WorkshopEvent) => `${fmtWhen(e.starts_at)}`;

export function confirmationEmail(
  event: WorkshopEvent,
  name: string,
  cancelUrl: string,
  waitlisted: boolean,
) {
  if (waitlisted) {
    return {
      subject: `Записах те при чакащите за „${event.title}“`,
      html: shell(`
        <h1 style="font-size:22px;margin:0 0 12px">Здравей, ${name}!</h1>
        <p style="font-size:15px;line-height:1.6">
          Местата за <strong>„${event.title}“</strong> на ${when(event)} свършиха,
          но те записах в листа на чакащите.
        </p>
        <p style="font-size:15px;line-height:1.6">
          Ако някой се откаже, пиша първо на теб. Случва се по-често, отколкото мислиш.
        </p>
        <p style="font-size:13px;color:#5C6B60">
          Ако размислиш: <a href="${cancelUrl}" style="color:#3E6B43">откажи мястото си</a>.
        </p>`),
    };
  }

  return {
    subject: `Мястото ти за „${event.title}“ е запазено`,
    html: shell(`
      <h1 style="font-size:22px;margin:0 0 12px">Здравей, ${name}!</h1>
      <p style="font-size:15px;line-height:1.6">Мястото ти е запазено. Ето подробностите:</p>
      <table style="font-size:15px;line-height:1.7;margin:16px 0">
        <tr><td style="padding-right:14px;color:#5C6B60">Работилница</td><td><strong>${event.title}</strong></td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Кога</td><td>${when(event)}</td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Къде</td><td>${event.venue_name}, ${event.venue_address}</td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Цена</td><td>${fmtPrice(event.price_cents)} - плащаш на място</td></tr>
      </table>
      ${event.bring_note ? `<p style="font-size:15px;line-height:1.6">${event.bring_note}</p>` : ''}
      <p style="font-size:13px;color:#5C6B60">
        Ако нещо се промени: <a href="${cancelUrl}" style="color:#3E6B43">откажи мястото си</a>,
        за да го подарим на някой от чакащите.
      </p>`),
  };
}

/**
 * The day before.
 *
 * Short on purpose: it is read on a telephone, on the way somewhere, and the
 * only things that matter are when, where, and the way out if something has
 * come up. The cancel link is in here as much for her as for them - a place
 * released the evening before is a place somebody on the waiting list can
 * still take.
 */
export function reminderEmail(
  r: { full_name: string; event_title: string; starts_at: string; venue_name: string; venue_address: string; bring_note: string | null },
  cancelUrl: string,
) {
  return {
    subject: `Утре е „${r.event_title}“`,
    html: shell(`
      <h1 style="font-size:22px;margin:0 0 12px">Здравей, ${r.full_name}!</h1>
      <p style="font-size:15px;line-height:1.6">
        Напомням ти за <strong>„${r.event_title}“</strong>.
      </p>
      <table style="font-size:15px;line-height:1.7;margin:16px 0">
        <tr><td style="padding-right:14px;color:#5C6B60">Кога</td><td><strong>${fmtWhen(r.starts_at)}</strong></td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Къде</td><td>${r.venue_name}, ${r.venue_address}</td></tr>
      </table>
      ${r.bring_note ? `<p style="font-size:15px;line-height:1.6">${r.bring_note}</p>` : ''}
      <p style="font-size:13px;color:#5C6B60">
        Ако все пак не можеш да дойдеш, <a href="${cancelUrl}" style="color:#3E6B43">откажи мястото си</a> -
        така ще го подарим на някой от чакащите.
      </p>`),
  };
}

export function noticeEmail(event: WorkshopEvent, reg: {
  full_name: string; email: string; phone: string; people_count: number; note?: string | null;
}, status: string, progress: string | null = null) {
  return {
    subject: `${status === 'waitlist' ? 'Чакащ' : 'Ново записване'}: ${event.title}`,
    html: shell(`
      <h1 style="font-size:20px;margin:0 0 12px">
        ${status === 'waitlist' ? 'Нов човек в листа на чакащите' : 'Ново записване'}
      </h1>
      <table style="font-size:15px;line-height:1.7">
        <tr><td style="padding-right:14px;color:#5C6B60">Работилница</td><td>${event.title} · ${when(event)}</td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Име</td><td><strong>${reg.full_name}</strong></td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Телефон</td><td>${reg.phone}</td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Имейл</td><td>${reg.email}</td></tr>
        <tr><td style="padding-right:14px;color:#5C6B60">Места</td><td>${reg.people_count}</td></tr>
        ${reg.note ? `<tr><td style="padding-right:14px;color:#5C6B60">Бележка</td><td>${reg.note}</td></tr>` : ''}
      </table>
      ${progress ? `<p style="font-size:14px;color:#5C6B60">${progress}</p>` : ''}`),
  };
}

export async function deliver(to: string, mail: { subject: string; html: string }): Promise<Sent> {
  return send(to, mail.subject, mail.html);
}

export const ownerAddress = () => env('OWNER_EMAIL') ?? 'djeilqart@gmail.com';

/**
 * Whether this deploy can send at all.
 *
 * The site used to tell every visitor „Пратих потвърждение“ whether or not
 * there was anything behind it to send with. The pages ask this first now.
 */
export const emailsConfigured = () => Boolean(env('RESEND_API_KEY') && env('MAIL_FROM'));
